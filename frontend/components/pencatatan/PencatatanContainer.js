// components/pencatatan/PencatatanContainer.js
// Daftar & kelola pencatatan barang sementara (belum diinput keuangan)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, IconButton, Tooltip,
  Snackbar, Alert, CircularProgress, TextField, InputAdornment, Fade,
} from '@mui/material';
import {
  Add as AddIcon, Refresh as RefreshIcon, Search as SearchIcon,
  Edit as EditIcon, Delete as DeleteIcon, CheckCircle as CheckCircleIcon,
  Replay as ReplayIcon, Inventory as InventoryIcon, PendingActions as PendingActionsIcon,
  DoneAll as DoneAllIcon, Clear as ClearIcon,
} from '@mui/icons-material';
import * as api from './api/pencatatanApi';
import PolishedPageShell from '../common/PolishedPageShell';
import ConfirmDialog from '../common/ConfirmDialog';
import PencatatanFormModal from './modals/PencatatanFormModal';
import PencatatanSelesaiModal from './modals/PencatatanSelesaiModal';

const statusColors = { belum: 'warning', selesai: 'success' };
const statusLabels = { belum: 'Perlu Tindak Lanjut', selesai: 'Selesai / Diproses' };

export default function PencatatanContainer({ session, tipe }) {
  const isDiterima = tipe === 'diterima';
  const title = isDiterima ? 'Pencatatan Barang Diterima' : 'Pencatatan Barang Diambil User';
  const subtitle = isDiterima
    ? 'Barang diterima fisik tetapi belum diinput bagian keuangan'
    : 'Barang diambil/diminta user sebelum penginputan bagian keuangan';

  const roles = session?.user?.roles || [];
  const isManager = session?.user?.isPicGudang || roles.includes('pic_gudang')
    || roles.includes('admin') || roles.includes('superadmin') || roles.includes('admin_pemeliharaan');

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ currentPage: 1, perPage: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selesaiOpen, setSelesaiOpen] = useState(false);
  const [selesaiItem, setSelesaiItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const showSnackbar = (msg, sev = 'success') => setSnackbar({ open: true, message: msg, severity: sev });

  const fetchData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = { tipe, page: pagination.currentPage, limit: pagination.perPage };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const res = await api.fetchPencatatan(session, params);
      if (res.success) {
        setList(res.data || []);
        if (res.pagination) setPagination(prev => ({ ...prev, ...res.pagination }));
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [session, tipe, pagination.currentPage, pagination.perPage, filters.status, filters.search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // fetch counter untuk kartu statistik
  const [counter, setCounter] = useState(null);
  const fetchCounter = useCallback(async () => {
    if (!session) return;
    try {
      const res = await api.fetchCounter(session);
      if (res.success) setCounter(res.data);
    } catch (e) { /* silent */ }
  }, [session]);
  useEffect(() => { fetchCounter(); }, [fetchCounter]);

  const handleSubmit = async (formData) => {
    setModalLoading(true);
    try {
      const res = editing
        ? await api.updatePencatatan(session, editing.id, formData)
        : await api.createPencatatan(session, formData);
      if (res.success) { showSnackbar(res.message); setFormOpen(false); setEditing(null); fetchData(); fetchCounter(); }
      else showSnackbar(res.message || 'Gagal menyimpan', 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
    finally { setModalLoading(false); }
  };

  const handleSelesai = async (data) => {
    setModalLoading(true);
    try {
      const res = await api.selesaiPencatatan(session, selesaiItem.id, data);
      if (res.success) { showSnackbar(res.message); setSelesaiOpen(false); setSelesaiItem(null); fetchData(); fetchCounter(); }
      else showSnackbar(res.message || 'Gagal', 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
    finally { setModalLoading(false); }
  };

  const handleBuka = async (item) => {
    try {
      const res = await api.bukaPencatatan(session, item.id);
      if (res.success) { showSnackbar(res.message); fetchData(); fetchCounter(); }
      else showSnackbar(res.message || 'Gagal', 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const handleDelete = async (item) => {
    setConfirmDelete({ open: true, item });
  };

  const doDelete = async () => {
    if (!confirmDelete?.item) return;
    setModalLoading(true);
    try {
      const res = await api.deletePencatatan(session, confirmDelete.item.id);
      if (res.success) { showSnackbar(res.message); setConfirmDelete({ open: false, item: null }); fetchData(); fetchCounter(); }
      else showSnackbar(res.message || 'Gagal hapus', 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
    finally { setModalLoading(false); }
  };

  const belumCount = list.filter(x => x.status === 'belum').length;
  const statCards = [
    {
      label: 'Total Tercatat',
      value: counter ? (isDiterima ? counter.diterima_total : counter.diambil_total) : pagination.total,
      icon: <InventoryIcon sx={{ fontSize: 22 }} />, color: '#3b82f6', maxValue: 100,
    },
    {
      label: 'Perlu Tindak Lanjut',
      value: counter ? (isDiterima ? counter.diterima_belum : counter.diambil_belum) : belumCount,
      icon: <PendingActionsIcon sx={{ fontSize: 22 }} />, color: '#f59e0b', maxValue: 100,
    },
    {
      label: 'Sudah Selesai',
      value: counter ? (isDiterima ? counter.diterima_total - counter.diterima_belum : counter.diambil_total - counter.diambil_belum) : (pagination.total - belumCount),
      icon: <DoneAllIcon sx={{ fontSize: 22 }} />, color: '#10b981', maxValue: 100,
    },
  ];

  const resetFilters = () => { setFilters({ status: '', search: '' }); setPagination(p => ({ ...p, currentPage: 1 })); };

  return (
    <PolishedPageShell
      title={title}
      subtitle={subtitle}
      statistics={statCards}
      actions={
        <>
          <TextField size="small" placeholder="Cari..." value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' } } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.6)' }} /></InputAdornment> }} />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { fetchData(); fetchCounter(); }}
            disabled={loading} sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.08)' } }}>
            Refresh
          </Button>
          {isManager && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormOpen(true); }}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              + Baru
            </Button>
          )}
        </>
      }
    >
      {/* Filter status */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ key: '', label: 'Semua' }, { key: 'belum', label: 'Perlu Tindak Lanjut' }, { key: 'selesai', label: 'Selesai / Diproses' }].map(f => (
          <Chip key={f.key || 'all'} label={f.label} onClick={() => { setFilters(prev => ({ ...prev, status: f.key })); setPagination(p => ({ ...p, currentPage: 1 })); }}
            color={filters.status === f.key ? 'primary' : 'default'} variant={filters.status === f.key ? 'filled' : 'outlined'} clickable />
        ))}
        {(filters.search || filters.status) && (
          <Button size="small" color="error" variant="text" onClick={resetFilters}>Reset</Button>
        )}
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.78rem', color: '#64748b' } }}>
              <TableCell>Tanggal</TableCell>
              <TableCell>Barang</TableCell>
              <TableCell align="center">Jumlah</TableCell>
              <TableCell>{isDiterima ? 'Sumber / Pemberi' : 'User / Peminta'}</TableCell>
              <TableCell>Catatan</TableCell>
              <TableCell>Status</TableCell>
              {isManager && <TableCell align="center">Aksi</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id} hover sx={{ '&:last-child td': { border: 0 }, bgcolor: row.status === 'belum' ? '#fffbf0' : 'inherit' }}>
                <TableCell>{row.tanggal ? String(row.tanggal).slice(0, 10) : '-'}</TableCell>
                <TableCell>
                  <Typography fontWeight={500} variant="body2">{row.nama_barang}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[row.jenis, row.kategori].filter(Boolean).join(' · ') || '-'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip label={`${row.jumlah} ${row.satuan || ''}`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{row.tipe === 'diterima' ? (row.sumber || '-') : (row.penerima || '-')}</Typography>
                  {row.tipe === 'diterima' && row.penerima && <Typography variant="caption" color="text.secondary">Diterima: {row.penerima}</Typography>}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.catatan || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={statusLabels[row.status] || row.status} size="small" color={statusColors[row.status] || 'default'} />
                  {row.status === 'selesai' && row.status_catatan && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>{row.status_catatan}</Typography>
                  )}
                </TableCell>
                {isManager && (
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.25 }}>
                      {row.status === 'belum' && (
                        <Tooltip title="Tandai Selesai / Sudah Diproses">
                          <IconButton size="small" color="success" onClick={() => { setSelesaiItem(row); setSelesaiOpen(true); }}>
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {row.status === 'selesai' && (
                        <Tooltip title="Buka Kembali">
                          <IconButton size="small" color="warning" onClick={() => handleBuka(row)}>
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditing(row); setFormOpen(true); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Hapus">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {list.length === 0 && !loading && (
              <TableRow><TableCell colSpan={isManager ? 7 : 6} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada pencatatan</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={pagination.total} page={pagination.currentPage - 1}
          onPageChange={(e, p) => setPagination(prev => ({ ...prev, currentPage: p + 1 }))}
          rowsPerPage={pagination.perPage}
          onRowsPerPageChange={(e) => setPagination(prev => ({ ...prev, perPage: parseInt(e.target.value, 10), currentPage: 1 }))}
          rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Baris/hal"
        />
      </TableContainer>

      <Box mt={1.5}>
        <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
          Pencatatan ini adalah <b>dokumentasi sementara</b>. Counter di sub-menu akan berkurang otomatis setelah dicatat <b>selesai / diproses</b> (sudah diinput keuangan atau sudah dicatat sebagai barang keluar).
        </Alert>
      </Box>

      {/* Modals */}
      <PencatatanFormModal
        open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit} tipe={tipe} initialData={editing} loading={modalLoading} />
      <PencatatanSelesaiModal
        open={selesaiOpen} onClose={() => { setSelesaiOpen(false); setSelesaiItem(null); }}
        onConfirm={handleSelesai} item={selesaiItem} loading={modalLoading} />

      {/* Confirm delete */}
      <ConfirmDialog
        open={Boolean(confirmDelete?.open)}
        title="Konfirmasi Hapus"
        message={`Hapus pencatatan "${confirmDelete?.item?.nama_barang || ''}"?`}
        confirmLabel="Hapus"
        onClose={() => setConfirmDelete({ open: false, item: null })}
        onConfirm={doDelete}
        loading={modalLoading}
      />

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ minWidth: 300 }}>{snackbar.message}</Alert>
      </Snackbar>
    </PolishedPageShell>
  );
}
