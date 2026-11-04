// Unit test: folder upload harus SATU untuk penulis dan pembaca file.
// Regresi yang dicegah: upload ke <backend>/uploads tapi /uploads membaca
// UPLOADS_PATH (/data/uploads di docker) -> "File not found".
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODULE_PATH = require.resolve('../utils/uploadsDir');

const loadFresh = (uploadsPath) => {
  delete require.cache[MODULE_PATH];
  if (uploadsPath === undefined) delete process.env.UPLOADS_PATH;
  else process.env.UPLOADS_PATH = uploadsPath;
  return require('../utils/uploadsDir');
};

describe('utils/uploadsDir', () => {
  let tmpDir;
  let originalPath;
  let createdFiles = [];

  beforeEach(() => {
    originalPath = process.env.UPLOADS_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
    createdFiles = [];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    createdFiles.forEach((f) => fs.rmSync(f, { force: true }));
    if (originalPath === undefined) delete process.env.UPLOADS_PATH;
    else process.env.UPLOADS_PATH = originalPath;
    delete require.cache[MODULE_PATH];
  });

  it('menulis ke UPLOADS_PATH bila di-set', () => {
    const u = loadFresh(tmpDir);
    assert.strictEqual(u.UPLOADS_DIR, path.resolve(tmpDir));
    assert.strictEqual(u.ensureUploadsDir(), path.resolve(tmpDir));
    assert.ok(fs.existsSync(tmpDir));
  });

  it('memakai <backend>/uploads bila UPLOADS_PATH tidak di-set', () => {
    const u = loadFresh(undefined);
    assert.strictEqual(u.UPLOADS_DIR, u.LEGACY_UPLOADS_DIR);
    assert.deepStrictEqual(u.CANDIDATE_DIRS, [u.LEGACY_UPLOADS_DIR]);
  });

  it('tetap menemukan file lama di <backend>/uploads (fallback)', () => {
    const u = loadFresh(tmpDir);
    const nama = `uji-lama-${Date.now()}.txt`;
    const fileLama = path.join(u.LEGACY_UPLOADS_DIR, nama);
    fs.mkdirSync(u.LEGACY_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(fileLama, 'x');
    createdFiles.push(fileLama);

    assert.strictEqual(u.findUpload(nama), fileLama);
  });

  it('mengutamakan folder aktif daripada folder lama', () => {
    const u = loadFresh(tmpDir);
    const nama = `uji-baru-${Date.now()}.txt`;
    const fileBaru = path.join(u.UPLOADS_DIR, nama);
    const fileLama = path.join(u.LEGACY_UPLOADS_DIR, nama);
    fs.writeFileSync(fileBaru, 'baru');
    fs.mkdirSync(u.LEGACY_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(fileLama, 'lama');
    createdFiles.push(fileBaru, fileLama);

    assert.strictEqual(u.findUpload(nama), fileBaru);
  });

  it('menolak nama file dengan path traversal', () => {
    const u = loadFresh(tmpDir);
    assert.strictEqual(u.findUpload('../../etc/passwd'), null);
    assert.strictEqual(u.findUpload('..\\..\\windows\\win.ini'), null);
    assert.strictEqual(u.sanitizeFileName('..'), '');
  });
});
