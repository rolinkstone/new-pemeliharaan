// components/glassware/GlasswareContainer.js
// Persediaan Glassware (Stok Opname Laboratorium)
//
// v2: Barang masuk & glassware pecah adalah TRANSAKSI yang boleh terjadi
// lebih dari 1 kali per item per periode (menyamakan pola ATK/Reagen).
//
// UI: 3 bagian -> Rekap Stok | Barang Masuk | Glassware Pecah
// Semua user login melihat; tambah/hapus hanya pic_gudang/pic_lab/admin.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, TextField, MenuItem, LinearProgress,
  Alert, Snackbar, CircularProgress, IconButton, Autocomplete, InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import ScienceIcon from '@mui/icons-material/Science';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import SearchIcon from '@mui/icons-material/Search';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import * as api from './api/glasswareApi';
import PolishedPageShell from '../common/PolishedPageShell';
import MovementSummaryCard from '../common/MovementSummaryCard';
import { formatDateForDisplay } from '../../utils/formatters';

const JENIS_OPTIONS = [
  { id: 1, label: 'Kuantitatif' },
  { id: 2, label: 'Kualitatif' },
];

const stokColor = (v) => {
  if (v === 0) return 'error';
  if (v <= 3) return 'warning';
  return 'success';
};

const PAGE_LABELS = { rekap: 'Rekap Stok', masuk: 'Barang Masuk', pecah: 'Glassware Pecah' };

export default function GlasswareContainer({ session }) {
  const [labs, setLabs] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [labId, setLabId] = useState(null);
  const [jenisId, setJenisId] = useState(1);
  const [periodeId, setPeriodeId] = useState(null);
  const [page, setPage] = useState('rekap');
  const [rekap, setRekap] = useState([]);
  const [masukList, setMasukList] = useState([]);
  const [pecahList, setPecahList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [tblPage, setTblPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [periodModal, setPeriodModal] = useState({ open: false, nama: '', tanggal: '', loading: false });
  const [transModal, setTransModal] = useState({ open: false, tipe: 'masuk', item: null, tanggal: '', jumlah: '', keterangan: '', loading: false });
  const [movementRows, setMovementRows] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [gwModal, setGwModal] = useState({ open: false, nomor_kontrol: '', nama: '', jenis_id: 1, ukuran: '', satuan: '', stok_awal: '', loading: false });

  const roles = session?.user?.roles || (session?.user?.role ? [session.user.role] : []);
  const canEdit = ['pic_gudang', 'pic_lab', 'admin', 'superadmin'].some((r) => roles.includes(r));
  const isAdmin = ['admin', 'superadmin'].some((r) => roles.includes(r));
  // Menambah periode & master glassware: pic_lab TIDAK boleh
  const canManage = ['pic_gudang', 'admin', 'superadmin'].some((r) => roles.includes(r));
  const showSnackbar = (msg, sev = 'success') => setSnackbar({ open: true, message: msg, severity: sev });

  const fetchMeta = useCallback(async () => {
    if (!session) return;
    try {
      const [labRes, periodRes] = await Promise.all([api.fetchLaboratorium(session), api.fetchPeriode(session)]);
      if (labRes.success) setLabs(labRes.data || []);
      if (periodRes.success) setPeriods(periodRes.data || []);
    } catch (e) { /* silent */ }
  }, [session]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { if (labId === null && labs.length) setLabId(labs[0].id); }, [labs, labId]);
  useEffect(() => { if (periodeId === null && periods.length) setPeriodeId(periods[0].id); }, [periods, periodeId]);

  const fetchData = useCallback(async () => {
    if (!session || !periodeId || !labId) return;
    setLoading(true);
    try {
      const params = { periode_id: periodeId, lab: labId, jenis: jenisId };
      const [r, m, p] = await Promise.all([api.fetchStok(session, params), api.fetchMasuk(session, params), api.fetchPecah(session, params)]);
      if (r.success) setRekap(r.data || []);
      if (m.success) setMasukList(m.data || []);
      if (p.success) setPecahList(p.data || []);
      setTblPage(0);
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [session, periodeId, labId, jenisId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pemantauan glassware tidak bergerak (per lab + jenis)
  const fetchMovement = useCallback(async () => {
    if (!session || !labId) return;
    setMovementLoading(true);
    try {
      const res = await api.fetchMovement(session, { lab: labId, jenis: jenisId });
      if (res.success) setMovementRows(res.data || []);
    } catch (e) { /* silent */ }
    finally { setMovementLoading(false); }
  }, [session, labId, jenisId]);

  useEffect(() => { fetchMovement(); }, [fetchMovement]);

  const curLab = labs.find(l => l.id === labId);
  const curJenis = JENIS_OPTIONS.find(j => j.id === jenisId);

  // ===== Pencarian & REKAP totals =====
  const q = search.trim().toLowerCase();
  const matchesSearch = (r) => !q
    || String(r.nama || '').toLowerCase().includes(q)
    || String(r.nomor_kontrol || '').toLowerCase().includes(q);
  const filteredRekap = q ? rekap.filter(matchesSearch) : rekap;
  const filteredMasuk = q ? masukList.filter(matchesSearch) : masukList;
  const filteredPecah = q ? pecahList.filter(matchesSearch) : pecahList;

  const totals = filteredRekap.reduce((acc, r) => ({
    stok: acc.stok + (Number(r.stok_saat_ini) || 0),
    masuk: acc.masuk + (Number(r.total_masuk) || 0),
    pecah: acc.pecah + (Number(r.total_pecah) || 0),
  }), { stok: 0, masuk: 0, pecah: 0 });

  // ===== Transaksi modal =====
  const openTrans = (tipe) => setTransModal({ open: true, tipe, item: null, tanggal: '', jumlah: '', keterangan: '', loading: false });

  const submitTrans = async () => {
    const { tipe, item, tanggal, jumlah, keterangan } = transModal;
    if (!item || !tanggal || !jumlah || Number(jumlah) <= 0) {
      showSnackbar('Item, tanggal, dan jumlah (>0) wajib diisi', 'warning');
      return;
    }
    setTransModal(prev => ({ ...prev, loading: true }));
    try {
      const body = { periode_id: periodeId, laboratorium_id: labId, glassware_id: item.glassware_id, tanggal, jumlah: Number(jumlah), keterangan: keterangan || null };
      const res = tipe === 'masuk' ? await api.addMasuk(session, body) : await api.addPecah(session, body);
      if (res.success) {
        showSnackbar(res.message, 'success');
        setTransModal({ open: false, tipe: 'masuk', item: null, tanggal: '', jumlah: '', keterangan: '', loading: false });
        fetchData();
      } else {
        showSnackbar(res.message, 'error');
        setTransModal(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
      setTransModal(prev => ({ ...prev, loading: false }));
    }
  };

  const removeTrans = async (tipe, id) => {
    if (!window.confirm(`Hapus catatan ${PAGE_LABELS[tipe]} ini?`)) return;
    try {
      const res = tipe === 'masuk' ? await api.deleteMasuk(session, id) : await api.deletePecah(session, id);
      if (res.success) { showSnackbar(res.message, 'success'); fetchData(); }
      else showSnackbar(res.message, 'error');
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
    }
  };

  const openGlassware = () => setGwModal({ open: true, nomor_kontrol: '', nama: '', jenis_id: jenisId, ukuran: '', satuan: '', stok_awal: '', loading: false });

  const handleCreateGlassware = async () => {
    const g = gwModal;
    if (!g.nama.trim() || !g.jenis_id) { showSnackbar('Nama & jenis glassware wajib diisi', 'warning'); return; }
    setGwModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await api.addMaster(session, {
        nomor_kontrol: g.nomor_kontrol.trim() || null,
        nama: g.nama.trim(),
        jenis_id: g.jenis_id,
        ukuran: g.ukuran.trim() || '-',
        satuan: g.satuan.trim() || '-',
        periode_id: periodeId,
        laboratorium_id: labId,
        stok_awal: Number(g.stok_awal) || 0,
        tanggal: new Date().toISOString().slice(0, 10),
      });
      if (res.success) {
        showSnackbar(res.message, 'success');
        setGwModal({ open: false, nomor_kontrol: '', nama: '', jenis_id: jenisId, ukuran: '', satuan: '', stok_awal: '', loading: false });
        setJenisId(g.jenis_id);
        fetchData();
        fetchMovement();
      } else {
        showSnackbar(res.message, 'error');
        setGwModal(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
      setGwModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleCreatePeriode = async () => {
    const { nama, tanggal } = periodModal;
    if (!nama.trim() || !tanggal) { showSnackbar('Nama periode & tanggal wajib diisi', 'warning'); return; }
    setPeriodModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await api.createPeriode(session, { nama: nama.trim(), tanggal, keterangan: '' });
      if (res.success) {
        showSnackbar(res.message, 'success');
        setPeriodModal({ open: false, nama: '', tanggal: '', loading: false });
        const pRes = await api.fetchPeriode(session);
        if (pRes.success) setPeriods(pRes.data || []);
        if (res.data?.id) setPeriodeId(res.data.id);
      } else {
        showSnackbar(res.message, 'error');
        setPeriodModal(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
      setPeriodModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeletePeriode = async () => {
    if (!periodeId) return;
    const p = periods.find(x => x.id === periodeId);
    if (!window.confirm(`Hapus periode "${p?.nama || ''}" beserta seluruh stok & transaksinya? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await api.deletePeriode(session, periodeId);
      if (res.success) {
        showSnackbar(res.message, 'success');
        const pRes = await api.fetchPeriode(session);
        if (pRes.success) setPeriods(pRes.data || []);
        setPeriodeId(null);
        setRekap([]); setMasukList([]); setPecahList([]); setMovementRows([]);
      } else {
        showSnackbar(res.message, 'error');
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
    }
  };

  const pagedRekap = filteredRekap.slice(tblPage * perPage, tblPage * perPage + perPage);
  const statIcons = { rekap: <ScienceIcon sx={{ fontSize: 22 }} />, masuk: <Inventory2Icon sx={{ fontSize: 22 }} />, pecah: <BrokenImageIcon sx={{ fontSize: 22 }} /> };

  return (
    <PolishedPageShell
      title="Persediaan Glassware"
      subtitle="Stok opname glassware per laboratorium — barang masuk & pecah dapat dicatat lebih dari sekali per periode (seperti ATK/Reagen)"
      statistics={[
        { label: 'Total Item', value: filteredRekap.length, icon: statIcons.rekap, color: '#0284c7', maxValue: filteredRekap.length || 10, onClick: () => { setSearch(''); setPage('rekap'); setTblPage(0); } },
        { label: 'Total Stok Saat Ini', value: totals.stok, icon: statIcons.rekap, color: '#10b981', maxValue: totals.stok || 10, onClick: () => { setSearch(''); setPage('rekap'); setTblPage(0); } },
        { label: 'Total Masuk', value: totals.masuk, icon: statIcons.masuk, color: '#6366f1', maxValue: totals.masuk || 10, onClick: () => { setSearch(''); setPage('masuk'); setTblPage(0); } },
        { label: 'Total Pecah', value: totals.pecah, icon: statIcons.pecah, color: '#ef4444', maxValue: totals.pecah || 10, onClick: () => { setSearch(''); setPage('pecah'); setTblPage(0); } },
      ]}
      actions={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData} disabled={loading}
            sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.08)' } }}>
            Refresh
          </Button>
          {canEdit && (
            <>
              {canManage && (
                <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={() => setPeriodModal({ open: true, nama: '', tanggal: '', loading: false })}
                  sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  Buat Periode Baru
                </Button>
              )}
              {canManage && page === 'rekap' && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openGlassware}
                  sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                  Tambah Glassware
                </Button>
              )}
              {page !== 'rekap' && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openTrans(page)}
                  sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                  Tambah {PAGE_LABELS[page]}
                </Button>
              )}
            </>
          )}
        </Box>
      }
    >
      {labId && (
        <MovementSummaryCard
          rows={movementRows}
          loading={movementLoading}
          title="Glassware Tidak Bergerak"
          emptyText="Tidak ada glassware tanpa pergerakan"
        />
      )}

      {/* Filter bar */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={0.5}>
            <TextField select size="small" label="Periode" value={periodeId || ''} onChange={(e) => setPeriodeId(Number(e.target.value))} sx={{ minWidth: 240 }}>
              {periods.map(p => <MenuItem key={p.id} value={p.id}>{p.nama} ({p.tanggal})</MenuItem>)}
            </TextField>
            {isAdmin && periods.length > 0 && (
              <IconButton size="small" color="error" onClick={handleDeletePeriode} disabled={!periodeId}
                title="Hapus periode terpilih">
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <TextField select size="small" label="Laboratorium" value={labId || ''} onChange={(e) => setLabId(Number(e.target.value))} sx={{ minWidth: 220 }}>
            {labs.map(l => <MenuItem key={l.id} value={l.id}>{l.nama}</MenuItem>)}
          </TextField>
          <TextField
            size="small"
            placeholder="Cari nama / nomor glassware..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setTblPage(0); }}
            sx={{ minWidth: 240 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <Chip color="secondary" label={curLab ? curLab.kode : '-'} variant="outlined" />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {canEdit ? 'Mode: bisa menambah / menghapus transaksi' : 'Mode: hanya lihat'}
          </Typography>
        </Box>
      </Paper>

      {/* Sub-tab Jenis */}
      <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {JENIS_OPTIONS.map(j => (
          <button key={j.id} onClick={() => setJenisId(j.id)} style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.85rem', background: jenisId === j.id ? '#0ea5e9' : 'transparent',
            color: jenisId === j.id ? '#fff' : '#64748b', boxShadow: jenisId === j.id ? '0 2px 8px rgba(14,165,233,0.3)' : 'none',
          }}>
            Glassware {j.label}
          </button>
        ))}
        <Chip label={curJenis ? curJenis.label : ''} size="small" sx={{ alignSelf: 'center' }} color="info" variant="outlined" />
      </Box>

      {/* Main tab: Rekap | Masuk | Pecah */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
        {Object.entries(PAGE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => { setPage(key); setTblPage(0); }} style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.85rem', background: page === key ? '#0284c7' : 'transparent',
            color: page === key ? '#fff' : '#64748b', boxShadow: page === key ? '0 2px 8px rgba(2,132,199,0.3)' : 'none',
          }}>
            {label}
          </button>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          {curLab?.nama} · Glassware {curJenis?.label}
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* ================= REKAP ================= */}
      {page === 'rekap' && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f1f5f9', '& th': { fontWeight: 600, fontSize: '0.76rem', color: '#64748b' } }}>
                <TableCell>No</TableCell>
                <TableCell>Nomor Kontrol / Katalog</TableCell>
                <TableCell>Nama Glassware</TableCell>
                <TableCell align="right">Ukuran</TableCell>
                <TableCell>Satuan</TableCell>
                <TableCell align="right">Jml. Periode Sebelumnya</TableCell>
                <TableCell align="right">Barang Masuk (Total)</TableCell>
                <TableCell align="right">Pecah (Total)</TableCell>
                <TableCell align="right">Jml. Periode Saat Ini</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRekap.map((r, idx) => {
                const no = tblPage * perPage + idx + 1;
                const stok = Number(r.stok_saat_ini) || 0;
                return (
                  <TableRow key={r.glassware_id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell><Typography variant="body2" color="text.secondary">{no}</Typography></TableCell>
                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{r.nomor_kontrol || '-'}</Typography></TableCell>
                    <TableCell><Typography fontWeight={500} variant="body2">{r.nama}</Typography></TableCell>
                    <TableCell align="right">{r.ukuran || '-'}</TableCell>
                    <TableCell>{r.satuan || '-'}</TableCell>
                    <TableCell align="right"><Typography fontWeight={600}>{r.stok_sebelumnya}</Typography></TableCell>
                    <TableCell align="right">
                      {r.total_masuk > 0 ? (
                        <Chip label={`+${r.total_masuk}`} size="small" color="success" variant="outlined"
                          title={`${r.jml_transaksi_masuk} transaksi`} />
                      ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      {r.jml_transaksi_masuk > 0 && <Typography variant="caption" display="block" color="text.secondary">{r.jml_transaksi_masuk}×</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      {r.total_pecah > 0 ? (
                        <Chip label={`-${r.total_pecah}`} size="small" color="error" variant="outlined"
                          title={`${r.jml_transaksi_pecah} transaksi`} />
                      ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      {r.jml_transaksi_pecah > 0 && <Typography variant="caption" display="block" color="text.secondary">{r.jml_transaksi_pecah}×</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={stok} size="small" color={stokColor(stok)} sx={{ fontWeight: 700, minWidth: 46 }} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && filteredRekap.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                  {q ? 'Tidak ada glassware yang cocok dengan pencarian' : 'Belum ada data glassware'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination component="div" count={filteredRekap.length} page={tblPage}
            onPageChange={(e, p) => setTblPage(p)} rowsPerPage={perPage}
            onRowsPerPageChange={(e) => { setPerPage(parseInt(e.target.value, 10)); setTblPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Baris/hal" />
        </TableContainer>
      )}

      {/* ================= BARANG MASUK / PECAH (daftar transaksi) ================= */}
      {(page === 'masuk' || page === 'pecah') && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f1f5f9', '& th': { fontWeight: 600, fontSize: '0.76rem', color: '#64748b' } }}>
                <TableCell>No</TableCell>
                <TableCell>Tanggal</TableCell>
                <TableCell>Nomor Kontrol / Katalog</TableCell>
                <TableCell>Nama Glassware</TableCell>
                <TableCell align="right">Jumlah</TableCell>
                <TableCell>Keterangan</TableCell>
                {canEdit && <TableCell align="center">Aksi</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {(page === 'masuk' ? filteredMasuk : filteredPecah).map((t, idx) => (
                <TableRow key={t.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography variant="body2" color="text.secondary">{idx + 1}</Typography></TableCell>
                  <TableCell>{formatDateForDisplay(t.tanggal)}</TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{t.nomor_kontrol || '-'}</Typography></TableCell>
                  <TableCell><Typography fontWeight={500} variant="body2">{t.nama}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.ukuran && t.ukuran !== '-' ? `${t.ukuran} ${t.satuan}` : (t.satuan && t.satuan !== '-' ? t.satuan : '')}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={`${page === 'masuk' ? '+' : '-'}${t.jumlah}`} size="small"
                      color={page === 'masuk' ? 'success' : 'error'} variant="outlined" sx={{ fontWeight: 700 }} />
                  </TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{t.keterangan || '-'}</Typography></TableCell>
                  {canEdit && (
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => removeTrans(page, t.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!loading && (page === 'masuk' ? filteredMasuk : filteredPecah).length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 7 : 6} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                    {q
                      ? 'Tidak ada transaksi yang cocok dengan pencarian'
                      : `Belum ada catatan ${page === 'masuk' ? 'barang masuk' : 'pecah'}${canEdit ? ' — klik "Tambah" untuk mencatat' : ''}`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Modal Buat Periode */}
      <Dialog open={periodModal.open} onClose={() => setPeriodModal(prev => ({ ...prev, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddCircleOutlineIcon color="primary" /> Buat Periode Baru
          <IconButton sx={{ ml: 'auto' }} size="small" onClick={() => setPeriodModal(prev => ({ ...prev, open: false }))}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Nama Periode" size="small" value={periodModal.nama}
              onChange={(e) => setPeriodModal(prev => ({ ...prev, nama: e.target.value }))}
              placeholder="contoh: Semester II 2026 / Desember 2026" />
            <TextField label="Tanggal Efektif" type="date" size="small" value={periodModal.tanggal}
              onChange={(e) => setPeriodModal(prev => ({ ...prev, tanggal: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPeriodModal(prev => ({ ...prev, open: false }))}>Batal</Button>
          <Button variant="contained" onClick={handleCreatePeriode} disabled={periodModal.loading}>
            {periodModal.loading ? <CircularProgress size={18} /> : 'Simpan & Salin Stok'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Tambah Barang Masuk / Pecah */}
      <Dialog open={transModal.open} onClose={() => setTransModal(prev => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          {transModal.tipe === 'masuk' ? <Inventory2Icon color="success" /> : <BrokenImageIcon color="error" />}
          Tambah {PAGE_LABELS[transModal.tipe] || ''}
          <IconButton sx={{ ml: 'auto' }} size="small" onClick={() => setTransModal(prev => ({ ...prev, open: false }))}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              size="small"
              options={rekap}
              getOptionLabel={(o) => o ? `${o.nomor_kontrol || ''} · ${o.nama}` : ''}
              isOptionEqualToValue={(a, b) => a.glassware_id === b.glassware_id}
              value={transModal.item}
              onChange={(e, v) => setTransModal(prev => ({ ...prev, item: v }))}
              noOptionsText="Item tidak ditemukan"
              renderInput={(params) => <TextField {...params} label="Pilih Glassware" placeholder="Ketik nama / nomor kontrol..." />}
            />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Tanggal" type="date" size="small" value={transModal.tanggal}
                onChange={(e) => setTransModal(prev => ({ ...prev, tanggal: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
              <TextField label="Jumlah" type="number" size="small" value={transModal.jumlah}
                onChange={(e) => setTransModal(prev => ({ ...prev, jumlah: e.target.value }))}
                inputProps={{ min: 1 }} InputProps={{ startAdornment: <InputAdornment position="start">+</InputAdornment> }} />
            </Box>
            <TextField label="Keterangan (opsional)" size="small" multiline rows={2} value={transModal.keterangan}
              onChange={(e) => setTransModal(prev => ({ ...prev, keterangan: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransModal(prev => ({ ...prev, open: false }))}>Batal</Button>
          <Button variant="contained" color={transModal.tipe === 'masuk' ? 'success' : 'error'} onClick={submitTrans} disabled={transModal.loading}>
            {transModal.loading ? <CircularProgress size={18} /> : 'Simpan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Tambah Glassware (master) */}
      <Dialog open={gwModal.open} onClose={() => setGwModal(prev => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScienceIcon color="primary" /> Tambah Glassware (Master)
          <IconButton sx={{ ml: 'auto' }} size="small" onClick={() => setGwModal(prev => ({ ...prev, open: false }))}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Nama Glassware" size="small" required value={gwModal.nama}
              onChange={(e) => setGwModal(prev => ({ ...prev, nama: e.target.value }))}
              placeholder="contoh: Gelas Kimia 250 mL" />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Nomor Kontrol / Katalog" size="small" value={gwModal.nomor_kontrol}
                onChange={(e) => setGwModal(prev => ({ ...prev, nomor_kontrol: e.target.value }))} />
              <TextField select label="Jenis" size="small" value={gwModal.jenis_id}
                onChange={(e) => setGwModal(prev => ({ ...prev, jenis_id: Number(e.target.value) }))}>
                {JENIS_OPTIONS.map(j => <MenuItem key={j.id} value={j.id}>Glassware {j.label}</MenuItem>)}
              </TextField>
              <TextField label="Ukuran" size="small" value={gwModal.ukuran}
                onChange={(e) => setGwModal(prev => ({ ...prev, ukuran: e.target.value }))}
                placeholder="contoh: 250, -" />
              <TextField label="Satuan" size="small" value={gwModal.satuan}
                onChange={(e) => setGwModal(prev => ({ ...prev, satuan: e.target.value }))}
                placeholder="mL, pcs, -" />
            </Box>
            <TextField label="Stok Awal (opsional, dicatat sbg barang masuk)" type="number" size="small" value={gwModal.stok_awal}
              onChange={(e) => setGwModal(prev => ({ ...prev, stok_awal: e.target.value }))}
              inputProps={{ min: 0 }} helperText="Glassware baru akan didaftarkan ke lab & periode yang sedang dipilih." />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGwModal(prev => ({ ...prev, open: false }))}>Batal</Button>
          <Button variant="contained" onClick={handleCreateGlassware} disabled={gwModal.loading}>
            {gwModal.loading ? <CircularProgress size={18} /> : 'Simpan'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PolishedPageShell>
  );
}
