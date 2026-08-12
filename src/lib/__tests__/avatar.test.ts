jest.mock('../../supabaseClient', () => ({
  supabase: { storage: { from: jest.fn() } },
}));

import { supabase } from '../../supabaseClient';
import { pickImageFile, uploadAvatar } from '../avatar';

const mockStorageFrom = supabase.storage.from as jest.Mock;

function fakeFile(name: string, type?: string): File {
  return { name, type } as unknown as File;
}

describe('pickImageFile', () => {
  afterEach(() => {
    delete (global as any).document;
  });

  it('resolves null when there is no DOM document (SSR/native)', async () => {
    delete (global as any).document;

    await expect(pickImageFile()).resolves.toBeNull();
  });

  it('opens a file-picker input and resolves the chosen file', async () => {
    const fakeInput: any = { click: jest.fn() };
    (global as any).document = { createElement: jest.fn(() => fakeInput) };

    const promise = pickImageFile();
    const chosen = fakeFile('photo.png');
    fakeInput.files = [chosen];
    fakeInput.onchange();

    expect(document.createElement).toHaveBeenCalledWith('input');
    expect(fakeInput.type).toBe('file');
    expect(fakeInput.accept).toBe('image/*');
    expect(fakeInput.click).toHaveBeenCalled();
    await expect(promise).resolves.toBe(chosen);
  });

  it('resolves null when the picker is dismissed without a file', async () => {
    const fakeInput: any = { click: jest.fn() };
    (global as any).document = { createElement: jest.fn(() => fakeInput) };

    const promise = pickImageFile();
    fakeInput.files = null;
    fakeInput.onchange();

    await expect(promise).resolves.toBeNull();
  });
});

describe('uploadAvatar', () => {
  it('uploads to the user-scoped path and returns the public URL', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/avatar.png' } });
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl });

    const url = await uploadAvatar('user-1', fakeFile('photo.PNG', 'image/png'));

    expect(mockStorageFrom).toHaveBeenCalledWith('avatars');
    const [path, file, options] = upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/avatar_\d+\.png$/);
    expect(file.name).toBe('photo.PNG');
    expect(options).toEqual({ upsert: true, contentType: 'image/png' });
    expect(getPublicUrl).toHaveBeenCalledWith(path);
    expect(url).toBe('https://cdn.example/avatar.png');
  });

  it('falls back to image/jpeg when the file has no type', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/avatar.jpg' } });
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl });

    await uploadAvatar('user-1', fakeFile('photo.jpg'));

    const options = upload.mock.calls[0][2];
    expect(options.contentType).toBe('image/jpeg');
  });

  it('defaults to a jpg extension when the filename has no extension to extract', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/avatar.jpg' } });
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl });

    // An empty name makes `name.split('.').pop()` return '', which is what
    // actually triggers the `|| 'jpg'` fallback in the implementation.
    await uploadAvatar('user-1', fakeFile(''));

    const path = upload.mock.calls[0][0];
    expect(path).toMatch(/^user-1\/avatar_\d+\.jpg$/);
  });

  it('returns null when the upload fails', async () => {
    const upload = jest.fn().mockResolvedValue({ error: { message: 'storage down' } });
    const getPublicUrl = jest.fn();
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl });

    const url = await uploadAvatar('user-1', fakeFile('photo.png', 'image/png'));

    expect(url).toBeNull();
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
});
