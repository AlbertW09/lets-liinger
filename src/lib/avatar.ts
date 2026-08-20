import { supabase } from '../supabaseClient';

// Image picking + cropping. Self-contained DOM implementation for web (the
// app's current target): it appends its own overlays to <body>, the same
// approach the old file-input picker used. On native these functions no-op
// (guarded on `document`); a native build would swap in expo-image-picker.

const AVATAR_OUTPUT = 512;   // square avatar, px
const COVER_OUTPUT = 1280;   // event cover width, px

export type AvatarSource = 'library' | 'camera';

// Generic entry point: pick (or shoot) an image, then crop to `aspect`
// (width / height). aspect = 1 → square; ~1.78 → 16:9 cover.
export async function pickAndCropImage(source: AvatarSource, aspect = 1): Promise<File | null> {
  if (typeof document === 'undefined') return null;
  const file = source === 'camera' ? await capturePhoto() : await selectImageFile();
  if (!file) return null;
  return cropToAspect(file, aspect);
}

// Square avatar (back-compat helper).
export function pickAndCropAvatar(source: AvatarSource): Promise<File | null> {
  return pickAndCropImage(source, 1);
}

// --- 1. Choose an image from the device ----------------------------------
function selectImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
}

// --- 2. Take a photo with the webcam (getUserMedia) ----------------------
// Returns the full frame; framing is done in the crop step.
async function capturePhoto(): Promise<File | null> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.mediaDevices?.getUserMedia) return selectImageFile();

  let stream: MediaStream;
  try {
    stream = await nav.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch {
    return selectImageFile();
  }

  return new Promise<File | null>((resolve) => {
    const { overlay, panel } = makeOverlay();

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    (video as any).muted = true;
    video.srcObject = stream;
    Object.assign(video.style, {
      width: 'min(80vw, 360px)', height: 'min(80vw, 360px)',
      objectFit: 'cover', borderRadius: '12px', background: '#000',
    });
    panel.appendChild(video);

    const row = makeButtonRow();
    const cancel = makeButton('Cancel', false);
    const shoot = makeButton('Capture', true);
    row.append(cancel, shoot);
    panel.appendChild(row);

    function cleanup() {
      stream.getTracks().forEach((t) => t.stop());
      overlay.remove();
    }
    cancel.onclick = () => { cleanup(); resolve(null); };
    shoot.onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      cleanup();
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' }) : null);
      }, 'image/jpeg', 0.92);
    };
  });
}

// --- 3. Pan/zoom cropper (arbitrary aspect ratio) ------------------------
function cropToAspect(file: File, aspect: number): Promise<File | null> {
  return new Promise<File | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { overlay, panel } = makeOverlay();
      const vw = Math.min(window.innerWidth * 0.85, 360); // viewport width
      const vh = vw / aspect;                              // viewport height

      const nw = img.naturalWidth, nh = img.naturalHeight;
      let scale = Math.max(vw / nw, vh / nh); // "cover" the crop window
      const minScale = scale;
      let tx = (vw - nw * scale) / 2;
      let ty = (vh - nh * scale) / 2;

      const viewport = document.createElement('div');
      Object.assign(viewport.style, {
        width: `${vw}px`, height: `${vh}px`, overflow: 'hidden', position: 'relative',
        borderRadius: '16px', border: '2px solid #fff', touchAction: 'none', cursor: 'grab', background: '#000',
      });
      const el = document.createElement('img');
      el.src = url;
      el.draggable = false;
      Object.assign(el.style, { position: 'absolute', userSelect: 'none' });
      viewport.appendChild(el);
      panel.appendChild(viewport);

      function clamp() {
        const dispW = nw * scale, dispH = nh * scale;
        tx = Math.min(0, Math.max(vw - dispW, tx));
        ty = Math.min(0, Math.max(vh - dispH, ty));
      }
      function paint() {
        el.style.width = `${nw * scale}px`;
        el.style.height = `${nh * scale}px`;
        el.style.left = `${tx}px`;
        el.style.top = `${ty}px`;
      }
      clamp(); paint();

      let dragging = false, lastX = 0, lastY = 0;
      viewport.onpointerdown = (e) => {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        viewport.setPointerCapture(e.pointerId); viewport.style.cursor = 'grabbing';
      };
      viewport.onpointermove = (e) => {
        if (!dragging) return;
        tx += e.clientX - lastX; ty += e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        clamp(); paint();
      };
      viewport.onpointerup = (e) => {
        dragging = false; viewport.releasePointerCapture(e.pointerId); viewport.style.cursor = 'grab';
      };

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '1'; slider.max = '4'; slider.step = '0.01'; slider.value = '1';
      Object.assign(slider.style, { width: `${vw}px`, marginTop: '14px', accentColor: '#FF007F' });
      slider.oninput = () => {
        const cx = (vw / 2 - tx) / scale, cy = (vh / 2 - ty) / scale;
        scale = minScale * parseFloat(slider.value);
        tx = vw / 2 - cx * scale; ty = vh / 2 - cy * scale;
        clamp(); paint();
      };
      panel.appendChild(slider);

      const hint = document.createElement('div');
      hint.textContent = 'Drag to reposition · slide to zoom';
      Object.assign(hint.style, { color: '#bbb', fontSize: '12px', marginTop: '8px', fontFamily: 'system-ui, sans-serif' });
      panel.appendChild(hint);

      const row = makeButtonRow();
      const cancel = makeButton('Cancel', false);
      const save = makeButton('Save', true);
      row.append(cancel, save);
      panel.appendChild(row);

      function cleanup() { URL.revokeObjectURL(url); overlay.remove(); }
      cancel.onclick = () => { cleanup(); resolve(null); };
      save.onclick = () => {
        const outW = aspect >= 1 ? COVER_OUTPUT : AVATAR_OUTPUT;
        const outputW = aspect === 1 ? AVATAR_OUTPUT : outW;
        const outputH = Math.round(outputW / aspect);
        const canvas = document.createElement('canvas');
        canvas.width = outputW; canvas.height = outputH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const srcX = -tx / scale, srcY = -ty / scale;
          const srcW = vw / scale, srcH = vh / scale;
          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
        }
        cleanup();
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], `img_${Date.now()}.jpg`, { type: 'image/jpeg' }) : null);
        }, 'image/jpeg', 0.9);
      };
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// --- Small DOM helpers for the overlays ----------------------------------
function makeOverlay() {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.85)', zIndex: '99999',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const panel = document.createElement('div');
  Object.assign(panel.style, { display: 'flex', flexDirection: 'column', alignItems: 'center' });
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  return { overlay, panel };
}

function makeButtonRow() {
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '12px', marginTop: '16px' });
  return row;
}

function makeButton(label: string, primary: boolean) {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    padding: '10px 22px', borderRadius: '12px', fontWeight: '800', fontSize: '14px',
    cursor: 'pointer', border: '2px solid #000', fontFamily: 'system-ui, sans-serif',
    background: primary ? '#39FF14' : '#fff', color: '#000',
  });
  return btn;
}

// --- Uploads --------------------------------------------------------------
async function uploadImage(bucket: string, path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
  if (error) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  return uploadImage('avatars', `${userId}/avatar_${Date.now()}.${ext}`, file);
}

export async function uploadEventCover(userId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  return uploadImage('event-covers', `${userId}/cover_${Date.now()}.${ext}`, file);
}
