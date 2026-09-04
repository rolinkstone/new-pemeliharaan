// components/glassware/PengajuanMt.js
// Pengajuan catatan semester (periode + lab) ke role MT untuk disetujui.
//
// Alur:
//   - pic_lab (role pencatat) mencatat transaksi masuk / pecah selama satu
//     periode (= satu semester).
//   - Di akhir semester pic_lab mengirim catatan periode+lab ke seorang MT
//     (user ber-role "mt" yang DIPILIH): (belum ada) -> menunggu_mt.
//   - MT menyetujui (disetujui, catatan terkunci) atau menolak (ditolak +
//     alasan -> pic_lab perbaiki lalu kirim ulang).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ScienceIcon from '@mui/icons-material/Science';
import * as api from './api/glasswareApi';
import { formatDateForDisplay } from '../../utils/formatters';

const STATUS_META = {
  menunggu_mt: { label: 'Menunggu MT', color: 'warning' },
  disetujui: { label: 'Disetujui MT', color: 'success' },
  ditolak: { label: 'Ditolak MT', color: 'error' },
};
const statusMeta = (status) => (status && STATUS_META[status]) || { label: 'Belum Diajukan', color: 'default' };

const cardSx = { p: 2, mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' };

export default function PengajuanMt({
  session, periodeId, labId, pengajuan, canKirimMt, isMt, isAdmin,
  periodeLabel, labLabel, onChanged, onOpenRecords,
}) {
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mtList, setMtList] = useState([]);
  const [kirimOpen, setKirimOpen] = useState(false);
  const [kirim, setKirim] = useState({ mt: null, catatan: '', loading: false });
  const [tolakRow, setTolakRow] = useState(null);
  const [tolak, setTolak] = useState({ alasan: '', loading: false });
  const [notice, setNotice] = useState(null);

  const status = pengajuan?.status || null;
  const meta = statusMeta(status);
  const canApprove = isMt || isAdmin;

  const fetchData = useCallback(async () => {
    if (!session || !periodeId || !labId) return;
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([
        api.fetchPengajuanSummary(session, { periode_id: periodeId, lab: labId }),
        api.fetchPengajuanList(session),
      ]);
      if (sRes.success) setSummary(sRes.data || {});
      if (lRes.success) setList(lRes.data || []);
    } catch (e) { /* silent */ }
    finally { setLoading(false); }
  }, [session, periodeId, labId]);

  useEffect(() => { fetchData(); }, [fetchData, pengajuan?.id, pengajuan?.status]);

  const flash = (severity, msg) => setNotice({ severity, msg });

  // ===== KIRIM KE MT =====
  const openKirim = async () => {
    setKirim({ mt: null, catatan: '', loading: false });
    setKirimOpen(true);
    try {
      const r = await api.fetchMtList(session);
      if (r.success) {
        const opts = r.data || [];
        setMtList(opts);
        if (pengajuan?.mt_id) {
          const prev = opts.find((x) => String(x.user_id || x.id) === String(pengajuan.mt_id)) || null;
          setKirim({ mt: prev, catatan: pengajuan?.catatan || '', loading: false });
        }
      }
    } catch (e) { /* silent */ }
  };

  const submitKirim = async () => {
    const mt = kirim.mt;
    if (!mt) { flash('warning', 'Pilih MT tujuan terlebih dahulu'); return; }
    setKirim((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.kirimPengajuan(session, {
        periode_id: periodeId,
        laboratorium_id: labId,
        mt_id: mt.user_id || mt.id,
        mt_nama: mt.nama || mt.username,
        catatan: kirim.catatan || null,
      });
      if (res.success) {
        setKirimOpen(false);
        flash('success', res.message);
        if (onChanged) onChanged();
      } else flash('error', res.message);
    } catch (e) {
      flash('error', e?.response?.data?.message || e.message);
    } finally {
      setKirim((prev) => ({ ...prev, loading: false }));
    }
  };

  // ===== SETUJUI / TOLAK OLEH MT =====
  const approve = async (row) => {
    if (!window.confirm(`Setujui pengajuan "${row.periode_nama}" (${row.lab_nama}) dari ${row.diajukan_by || '-'}?`)) return;
    try {
      const res = await api.setujuiPengajuan(session, row.id);
      if (res.success) flash('success', res.message);
      else flash('error', res.message);
      if (onChanged) onChanged();
    } catch (e) {
      flash('error', e?.response?.data?.message || e.message);
      if (onChanged) onChanged();
    }
  };

  const submitTolak = async () => {
    if (!tolakRow || !tolak.alasan.trim()) return;
    setTolak((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.tolakPengajuan(session, tolakRow.id, tolak.alasan.trim());
      if (res.success) { setTolakRow(null); flash('success', res.message); }
      else flash('error', res.message);
      if (onChanged) onChanged();
    } catch (e) {
      flash('error', e?.response?.data?.message || e.message);
    } finally {
      setTolak((prev) => ({ ...prev, loading: false }));
    }
  };

  const openRecords = (pid, lid) => {
    if (onOpenRecords) onOpenRecords(pid, lid);
    else if (onChanged) onChanged();
  };

  // Hapus pengajuan dari riwayat (khusus admin)
  const removePengajuan = async (row) => {
    const locked = row.status === 'menunggu_mt' || row.status === 'disetujui';
    const warn = locked
      ? `\n\nPERHATIAN: pengajuan ini berstatus ${row.status === 'disetujui' ? 'DISETUJUI' : 'MENUNGGU MT'} — menghapusnya akan MEMBUKA KEMBALI catatan transaksi periode tersebut.`
      : '';
    if (!window.confirm(`Hapus pengajuan "${row.periode_nama}" (${row.lab_nama}) dari riwayat?${warn}`)) return;
    try {
      const res = await api.deletePengajuan(session, row.id);
      if (res.success) flash('success', res.message);
      else flash('error', res.message);
      if (onChanged) onChanged();
    } catch (e) {
      flash('error', e?.response?.data?.message || e.message);
    }
  };

  const canSubmitCurrent = canKirimMt && (status === null || status === 'ditolak');
  const noRecordsYet = summary && summary.total_masuk_txn === 0 && summary.total_pecah_txn === 0;

  return (
    <Box>
      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.msg}
        </Alert>
      )}

      {/* ===== Kartu status semester (periode + lab aktif) ===== */}
      <Paper sx={cardSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <ScienceIcon color="primary" />
          <Typography fontWeight={700}>Pengajuan Semester · {periodeLabel || '-'} · {labLabel || '-'}</Typography>
          <Chip
            label={meta.label}
            size="small"
            color={meta.color}
            variant={status ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600, ml: 'auto' }}
          />
        </Box>

        {loading && <CircularProgress size={20} sx={{ mb: 1 }} />}

        {!loading && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
            <SummaryChip label="Total Item" value={summary?.total_item ?? '-'} />
            <SummaryChip label="Transaksi Masuk" value={summary ? `${summary.total_masuk_txn}× (${summary.total_masuk})` : '-'} />
            <SummaryChip label="Transaksi Pecah" value={summary ? `${summary.total_pecah_txn}× (${summary.total_pecah})` : '-'} />
          </Box>
        )}

        {status === 'menunggu_mt' && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Menunggu persetujuan <b>{pengajuan.mt_nama || 'MT'}</b> (diajukan {pengajuan.diajukan_at || ''} oleh {pengajuan.diajukan_by || '-'}).
            Catatan transaksi <b>terkunci</b> sampai ada keputusan MT.
          </Alert>
        )}
        {status === 'disetujui' && (
          <Alert severity="success" sx={{ mb: 1.5 }}>
            Disetujui oleh <b>{pengajuan.disetujui_by || '-'}</b> pada {pengajuan.disetujui_at || ''}. Catatan transaksi periode ini <b>terkunci</b>.
          </Alert>
        )}
        {status === 'ditolak' && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            Ditolak oleh <b>{pengajuan.ditolak_by || '-'}</b> pada {pengajuan.ditolak_at || ''}.
            Alasan: {pengajuan.catatan_tolak || '-'}. Perbaiki catatan lalu kirim ulang.
          </Alert>
        )}
        {status === null && canKirimMt && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Catatan periode ini <b>belum diajukan</b> ke MT. Setelah selesai mencatat transaksi (Barang Masuk & Pecah), kirim ke MT untuk disetujui.
          </Alert>
        )}
        {noRecordsYet && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Belum ada transaksi (masuk/pecah) pada periode & lab ini. Isi catatan di tab <b>Barang Masuk</b> / <b>Glassware Pecah</b> sebelum mengirim ke MT.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {canSubmitCurrent && (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={openKirim}
              disabled={Boolean(status === null && noRecordsYet)}
            >
              {status === 'ditolak' ? 'Kirim Ulang ke MT' : 'Kirim ke MT'}
            </Button>
          )}
          {status === 'menunggu_mt' && (
            <Button variant="contained" startIcon={<FactCheckIcon />} disabled>
              Menunggu Persetujuan MT
            </Button>
          )}
          {periodeId && labId && (
            <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={() => openRecords(periodeId, labId)}>
              Buka Catatan Transaksi
            </Button>
          )}
          {canKirimMt && (status === 'ditolak') && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              Transaksi sudah bisa diperbaiki kembali.
            </Typography>
          )}
        </Box>
      </Paper>

      {/* ===== Daftar pengajuan (per role) ===== */}
      <Paper sx={cardSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FactCheckIcon color={canApprove ? 'primary' : 'disabled'} />
          <Typography fontWeight={700}>
            {canApprove ? 'Persetujuan MT — Pengajuan Ditujukan ke Saya' : 'Riwayat Pengajuan Saya'}
          </Typography>
        </Box>

        {loading && <CircularProgress size={20} sx={{ mb: 1 }} />}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f1f5f9', '& th': { fontWeight: 600, fontSize: '0.76rem', color: '#64748b' } }}>
                <TableCell>Periode</TableCell>
                <TableCell>Lab</TableCell>
                <TableCell>Diajukan</TableCell>
                <TableCell>MT Tujuan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>
                    <Typography fontWeight={500} variant="body2">{row.periode_nama}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDateForDisplay(row.periode_tanggal)}</Typography>
                  </TableCell>
                  <TableCell>{row.lab_nama}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.diajukan_by || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.diajukan_at || ''}</Typography>
                  </TableCell>
                  <TableCell>{row.mt_nama || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={statusMeta(row.status).label}
                      size="small"
                      color={statusMeta(row.status).color}
                      variant={row.status ? 'filled' : 'outlined'}
                    />
                    {row.status === 'ditolak' && row.catatan_tolak && (
                      <Typography variant="caption" display="block" color="error.main" sx={{ maxWidth: 220 }} noWrap title={row.catatan_tolak}>
                        {row.catatan_tolak}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                      <IconButton size="small" title="Buka catatan" onClick={() => openRecords(row.periode_id, row.laboratorium_id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      {row.status === 'menunggu_mt' && canApprove && (
                        <>
                          <IconButton size="small" color="success" title="Setujui" onClick={() => approve(row)}>
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" title="Tolak" onClick={() => { setTolakRow(row); setTolak({ alasan: '', loading: false }); }}>
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                      {isAdmin && (
                        <IconButton size="small" color="error" title="Hapus dari riwayat (admin)" onClick={() => removePengajuan(row)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                    {canApprove
                      ? 'Tidak ada pengajuan yang ditujukan ke Anda.'
                      : canKirimMt
                        ? 'Belum ada pengajuan. Pilih periode & lab lalu klik "Kirim ke MT".'
                        : 'Belum ada pengajuan.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ===== Modal: Kirim / Kirim Ulang ke MT ===== */}
      <Dialog open={kirimOpen} onClose={() => setKirimOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SendIcon color="primary" /> {status === 'ditolak' ? 'Kirim Ulang Pengajuan ke MT' : 'Kirim Pengajuan ke MT'}
          <IconButton sx={{ ml: 'auto' }} size="small" onClick={() => setKirimOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Mengirim catatan <b>{periodeLabel || '-'}</b> · <b>{labLabel || '-'}</b> ke MT untuk persetujuan akhir semester.
            </Typography>
            <Autocomplete
              size="small"
              options={mtList}
              getOptionLabel={(o) => (o ? `${o.nama || o.username}${o.jabatan ? ` — ${o.jabatan}` : ''}` : '')}
              isOptionEqualToValue={(a, b) => String(a.user_id || a.id) === String(b.user_id || b.id)}
              value={kirim.mt}
              onChange={(e, v) => setKirim((prev) => ({ ...prev, mt: v }))}
              noOptionsText="Tidak ada user dengan role MT"
              renderInput={(params) => <TextField {...params} label="Pilih MT" placeholder="Cari nama MT..." />}
            />
            {mtList.length === 0 && !loading && (
              <Alert severity="warning" variant="outlined">
                Tidak ada user ber-role &quot;mt&quot; ditemukan. Pastikan role &quot;mt&quot; sudah dibuat & dipetakan ke user di Keycloak.
              </Alert>
            )}
            <TextField
              label="Catatan untuk MT (opsional)"
              size="small"
              multiline
              rows={2}
              value={kirim.catatan}
              onChange={(e) => setKirim((prev) => ({ ...prev, catatan: e.target.value }))}
              placeholder="contoh: Pengajuan catatan glassware akhir semester..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKirimOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={submitKirim} disabled={kirim.loading}>
            {kirim.loading ? <CircularProgress size={18} /> : 'Kirim ke MT'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Modal: Tolak dengan alasan ===== */}
      <Dialog open={Boolean(tolakRow)} onClose={() => setTolakRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BlockIcon color="error" /> Tolak Pengajuan
          <IconButton sx={{ ml: 'auto' }} size="small" onClick={() => setTolakRow(null)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Menolak pengajuan <b>{tolakRow?.periode_nama}</b> ({tolakRow?.lab_nama}) dari {tolakRow?.diajukan_by || '-'}.
              PIC Lab akan memperbaiki catatan lalu mengirim ulang.
            </Typography>
            <TextField
              label="Alasan Penolakan (wajib)"
              size="small"
              required
              multiline
              rows={2}
              value={tolak.alasan}
              onChange={(e) => setTolak((prev) => ({ ...prev, alasan: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTolakRow(null)}>Batal</Button>
          <Button variant="contained" color="error" onClick={submitTolak} disabled={tolak.loading || !tolak.alasan.trim()}>
            {tolak.loading ? <CircularProgress size={18} /> : 'Tolak Pengajuan'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SummaryChip({ label, value }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1, bgcolor: '#f8fafc' }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography fontWeight={700} variant="body2">{value}</Typography>
    </Box>
  );
}
