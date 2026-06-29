import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Alert, Snackbar, CircularProgress,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Chip, Tooltip, LinearProgress,
  Fade,
} from '@mui/material';
import {
  Add as AddIcon, Refresh as RefreshIcon, Edit as EditIcon,
  Delete as DeleteIcon, CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon, Inventory as InventoryIcon,
  Send as SendIcon, Download as DownloadIcon,
  Upload as UploadIcon, Assignment as AssignmentIcon,
  RemoveCircleOutline as RemoveIcon,
  ExpandMore as ExpandMoreIcon, ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import * as api from './api/persediaanApi';
import PolishedPageShell from '../common/PolishedPageShell';
import FilterSection from './FilterSection';
import KirimKeKatimModal from './modals/KirimKeKatimModal';
import ProsesSerahkanModal from './modals/ProsesSerahkanModal';
import ConfirmDialog from '../common/ConfirmDialog';
import RejectDialog from '../common/RejectDialog';
import { formatDateForDisplay } from '../../utils/formatters';

const statusColors = {
  draft: 'default',
  diajukan: 'warning',
  menunggu_katim: 'info',
  disetujui_katim: 'primary',
  disetujui_kabag: 'primary',

  disetujui: 'success',
  diserahkan: 'success',
  ditolak: 'error',
  diserahkan_sebagian: 'warning',
};

const statusLabels = {
  draft: 'Draft',
  diajukan: 'Diajukan',
  menunggu_katim: 'Menunggu Katim',
  disetujui_katim: 'Disetujui Katim',
  disetujui_kabag: 'Disetujui Kabag',

  disetujui: 'Disetujui',
  diserahkan: 'Diserahkan',
  ditolak: 'Ditolak',
  diserahkan_sebagian: 'Diserahkan Sebagian',
};

const PersediaanContainer = ({ session }) => {
  const [tab, setTab] = useState(0); // 0: Barang, 1: Barang Masuk, 2: Permintaan, 3: Opname
  const tabs = ['Barang', 'Barang Masuk', 'Permintaan', 'Stok Opname'];

  // Data states
  const [barangList, setBarangList] = useState([]);
  const [barangMasukList, setBarangMasukList] = useState([]);
  const [permintaanList, setPermintaanList] = useState([]);
  const [opnameList, setOpnameList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: '', jenis: '', kategori: '' });
  const [pagination, setPagination] = useState({ currentPage: 1, perPage: 10, total: 0, totalPages: 0 });
  const [bmPagination, setBmPagination] = useState({ currentPage: 1, perPage: 10, total: 0, totalPages: 0 });
  const [mutasiDateRange, setMutasiDateRange] = useState({ mulai: '', akhir: '' });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [historyModal, setHistoryModal] = useState({ open: false, data: [], title: '', jenis: '' });

  const showSnackbar = (msg, sev = 'success') => setSnackbar({ open: true, message: msg, severity: sev });

  const roles = session?.user?.realm_access?.roles || session?.user?.roles || [];
  const hasRole = (r) => roles.includes(r) || roles.includes('admin') || roles.includes('superadmin');
  const isPicGudang = hasRole('pic_gudang');
  const isPicPersediaan = hasRole('pic_persediaan');
  const isKatim = hasRole('katim');
  const isKabagTu = hasRole('kabag_tu');

  // Fetch ALL barang for dropdowns (no pagination)
  const fetchAllBarang = useCallback(async () => {
    if (!session) return [];
    try {
      const res = await api.fetchBarang(session, { limit: 9999 });
      return res.success ? res.data : [];
    } catch { return []; }
  }, [session]);

  // Full list of barang for dropdowns
  const [allBarang, setAllBarang] = useState([]);
  useEffect(() => { fetchAllBarang().then(setAllBarang); }, [fetchAllBarang]);

  // ========== FETCH (with pagination for table) ==========
  const fetchAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const params = { page: pagination.currentPage, limit: pagination.perPage };
      if (filters.search) params.search = filters.search;
      if (filters.jenis) params.jenis = filters.jenis;
      if (filters.kategori) params.kategori = filters.kategori;

      const mutasiParams = {};
      if (mutasiDateRange.mulai) mutasiParams.tanggal_mulai = mutasiDateRange.mulai;
      if (mutasiDateRange.akhir) mutasiParams.tanggal_akhir = mutasiDateRange.akhir;

      const bmParams = { page: bmPagination.currentPage, limit: bmPagination.perPage };
      const [barang, masuk, permintaan, opname, mutasi] = await Promise.all([
        api.fetchBarang(session, params),
        api.fetchBarangMasuk(session, bmParams),
        api.fetchPermintaan(session),
        api.fetchOpname(session, mutasiParams),
        api.fetchMutasiStok(session, mutasiParams),
      ]);
      if (barang.success) {
        setBarangList(barang.data);
        if (barang.pagination) setPagination(prev => ({ ...prev, ...barang.pagination }));
      }
      if (masuk.success) {
        setBarangMasukList(masuk.data);
        if (masuk.pagination) setBmPagination(prev => ({ ...prev, ...masuk.pagination }));
      }
      if (permintaan.success) setPermintaanList(permintaan.data);
      if (opname.success) setOpnameList(opname.data);
      if (mutasi.success) setMutasiList(mutasi.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, filters, pagination.currentPage, pagination.perPage, bmPagination.currentPage, bmPagination.perPage, mutasiDateRange.mulai, mutasiDateRange.akhir]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ========== MODAL HANDLERS ==========
  const openCreateModal = (mode) => {
    setModalMode(mode);
    setSelectedItem(null);
    setFormData({});
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    setSelectedItem(item);
    setFormData({ nama_barang: item.nama_barang, jenis: item.jenis, kategori: item.kategori, satuan: item.satuan });
    setModalOpen(true);
  };

  const handleCloseModal = () => setModalOpen(false);

  const handleSubmitBarang = async () => {
    try {
      if (modalMode === 'create') {
        const res = await api.createBarang(session, formData);
        if (res.success) { showSnackbar(res.message); fetchAll(); handleCloseModal(); }
        else showSnackbar(res.message, 'error');
      } else {
        const res = await api.updateBarang(session, selectedItem.id, formData);
        if (res.success) { showSnackbar(res.message); fetchAll(); handleCloseModal(); }
        else showSnackbar(res.message, 'error');
      }
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const handleDeleteBarang = async (id) => {
    setConfirmDialog({
      open: true,
      message: 'Apakah Anda yakin ingin menghapus barang ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.deleteBarang(session, id);
          if (res.success) { showSnackbar(res.message); fetchAll(); }
        } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
        finally { setConfirmDialog({ open: false, message: '', onConfirm: null }); }
      }
    });
  };

  // ========== BARANG MASUK ==========
  const [bmModalOpen, setBmModalOpen] = useState(false);
  const [bmUploading, setBmUploading] = useState(false);
  const [bmFile, setBmFile] = useState(null);
  const [bmKuitansiUrl, setBmKuitansiUrl] = useState('');
  const [bmItems, setBmItems] = useState([{ barang_id: '', jumlah: '', catatan: '' }]);
  const [bmCatatan, setBmCatatan] = useState('');
  const [bmTanggalPembelian, setBmTanggalPembelian] = useState('');

  const handleBmAddItem = () => {
    setBmItems(prev => [...prev, { barang_id: '', jumlah: '', catatan: '' }]);
  };

  const handleBmRemoveItem = (idx) => {
    if (bmItems.length <= 1) return;
    setBmItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBmItemChange = (idx, field, value) => {
    setBmItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleBmFileUpload = async (file) => {
    if (!file) return;
    setBmFile(file);
    setBmUploading(true);
    try {
      const res = await api.uploadFile(session, file);
      if (res?.success && res.data?.[0]?.url) {
        const url = `${api.BACKEND_HOST}${res.data[0].url}`;
        setBmKuitansiUrl(url);
        showSnackbar('File berhasil diupload', 'success');
      } else {
        showSnackbar('Gagal upload file', 'error');
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
    } finally {
      setBmUploading(false);
    }
  };

  const handleSubmitBarangMasuk = async () => {
    if (!bmKuitansiUrl) { showSnackbar('Upload nota/kuitansi terlebih dahulu', 'warning'); return; }
    const validItems = bmItems.filter(item => item.barang_id && item.jumlah);
    if (validItems.length === 0) { showSnackbar('Minimal 1 barang harus diisi', 'warning'); return; }
    try {
      const res = await api.createBarangMasukBatch(session, { kuitansi_url: bmKuitansiUrl, items: validItems, catatan_global: bmCatatan, tanggal_pembelian: bmTanggalPembelian || null });
      if (res.success) {
        showSnackbar(res.message);
        fetchAll();
        setBmModalOpen(false);
        setBmFile(null);
        setBmKuitansiUrl('');
        setBmItems([{ barang_id: '', jumlah: '', catatan: '' }]);
        setBmCatatan('');
        setBmTanggalPembelian('');
      } else showSnackbar(res.message, 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };



  // ========== DIALOG ==========
  const [confirmDialog, setConfirmDialog] = useState({ open: false, message: '', onConfirm: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, groupId: null, onConfirm: null });

  // ========== PERMINTAAN ==========
  const [permintaanModalOpen, setPermintaanModalOpen] = useState(false);
  const [permintaanItems, setPermintaanItems] = useState([{ barang_id: '', jumlah: '', catatan: '' }]);
  const [permintaanCatatan, setPermintaanCatatan] = useState('');
  const [permintaanTanggal, setPermintaanTanggal] = useState(typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : '');

  const handleSubmitPermintaan = async () => {
    try {
      const validItems = permintaanItems.filter(item => item.barang_id && item.jumlah);
      if (validItems.length === 0) {
        showSnackbar('Pilih minimal 1 barang', 'warning');
        return;
      }
      const res = await api.createPermintaan(session, { items: validItems, catatan: permintaanCatatan, tanggal: permintaanTanggal });
      if (res.success) {
        showSnackbar(res.message);
        fetchAll();
        setPermintaanModalOpen(false);
        setPermintaanItems([{ barang_id: '', jumlah: '', catatan: '' }]);
        setPermintaanCatatan('');
      } else showSnackbar(res.message, 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const addPermintaanItem = () => {
    if (permintaanItems.length >= 5) {
      showSnackbar('Maksimal 5 item', 'warning');
      return;
    }
    setPermintaanItems(prev => [...prev, { barang_id: '', jumlah: '', catatan: '' }]);
  };

  const removePermintaanItem = (idx) => {
    if (permintaanItems.length <= 1) return;
    setPermintaanItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePermintaanItem = (idx, field, value) => {
    setPermintaanItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  // Expanded rows for grouped permintaan
  const [expandedPermintaan, setExpandedPermintaan] = useState({});

  const handleDeletePermintaan = async (groupId) => {
    setConfirmDialog({
      open: true,
      message: 'Apakah Anda yakin ingin menghapus permintaan ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.deletePermintaan(session, groupId);
          if (res.success) { showSnackbar('Permintaan dihapus'); fetchAll(); }
          else showSnackbar(res.message || 'Gagal hapus', 'error');
        } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
        finally { setConfirmDialog({ open: false, message: '', onConfirm: null }); }
      }
    });
  };

  // ========== OPNAME ==========
  const [opnameModalOpen, setOpnameModalOpen] = useState(false);
  const [katimModal, setKatimModal] = useState({ open: false, groupId: null, itemCount: 0 });
  const [prosesModal, setProsesModal] = useState({ open: false, group: null });
  const today = typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : '';
  const [mutasiList, setMutasiList] = useState([]);
  const [mutasiPage, setMutasiPage] = useState(0);
  const [mutasiRowsPerPage, setMutasiRowsPerPage] = useState(10);
  const [opnamePage, setOpnamePage] = useState(0);
  const [opnameRowsPerPage, setOpnameRowsPerPage] = useState(10);
  const [opnameForm, setOpnameForm] = useState({ barang_id: '', stok_nyata: '', tanggal: today, catatan: '' });

  const handleSubmitOpname = async () => {
    try {
      const res = await api.createOpname(session, opnameForm);
      if (res.success) { showSnackbar(res.message); fetchAll(); setOpnameModalOpen(false); setOpnameForm({ barang_id: '', stok_nyata: '', tanggal: today || new Date().toISOString().split('T')[0], catatan: '' }); }
      else showSnackbar(res.message, 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const handleReject = (groupId, defaultAlasan = '') => {
    setRejectDialog({
      open: true,
      groupId,
      onConfirm: async (alasan) => {
        const r = await api.tolakPermintaan(session, groupId, alasan || defaultAlasan);
        if (r.success) { showSnackbar(r.message); fetchAll(); }
        setRejectDialog({ open: false, groupId: null, onConfirm: null });
      }
    });
  };

  if (!session) {
    return <Box p={3}><Alert severity="warning">Silakan login</Alert></Box>;
  }

  // ========== PAGINATION HANDLERS ==========
  const handleChangePage = (event, newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage + 1 }));
  };
  const handleChangeRowsPerPage = (event) => {
    setPagination(prev => ({ ...prev, currentPage: 1, perPage: parseInt(event.target.value, 10) }));
  };
  const handleBmChangePage = (event, newPage) => {
    setBmPagination(prev => ({ ...prev, currentPage: newPage + 1 }));
  };
  const handleBmChangeRowsPerPage = (event) => {
    setBmPagination(prev => ({ ...prev, currentPage: 1, perPage: parseInt(event.target.value, 10) }));
  };

  // ========== IMPORT / EXPORT ==========
  const handleDownloadTemplate = () => {
    window.open(api.downloadTemplateUrl, '_blank');
  };

  const handleImportXLSX = async (file) => {
    try {
      const res = await api.importXLSX(session, file);
      if (res.success) {
        showSnackbar(res.message + (res.data?.errors?.length ? '. Lihat console untuk detail' : ''), res.data?.failed > 0 ? 'warning' : 'success');
        if (res.data?.errors?.length) console.warn('Import errors:', res.data.errors);
        fetchAll();
      } else {
        showSnackbar(res.message || 'Gagal import', 'error');
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
    }
  };

  // ========== HISTORY MODAL ==========
  const openHistory = async (barang, jenis) => {
    try {
      const params = {};
      if (mutasiDateRange.mulai) params.tanggal_mulai = mutasiDateRange.mulai;
      if (mutasiDateRange.akhir) params.tanggal_akhir = mutasiDateRange.akhir;
      params.jenis = jenis;
      const res = await api.fetchMutasiDetail(session, barang.id, params);
      if (res.success) {
        setHistoryModal({ open: true, data: res.data, title: `${barang.nama_barang} — ${jenis === 'masuk' ? 'Barang Masuk' : 'Barang Keluar'}`, jenis });
      }
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const getStatCards = () => {
    const totalBarang = allBarang.length || pagination.total || barangList.length;
    const totalStok = allBarang.reduce((sum, b) => sum + (b.saldo || 0), 0);
    const permintaanAktif = permintaanList.filter(p => !['diserahkan', 'ditolak', 'diserahkan_sebagian', 'disetujui_kabag'].includes(p.status)).length;
    return [
      { label: 'Total Barang', value: totalBarang, icon: <InventoryIcon sx={{ fontSize: 22 }} />, color: '#3b82f6', maxValue: totalBarang || 100 },
      { label: 'Stok Total', value: totalStok, icon: <AssignmentIcon sx={{ fontSize: 22 }} />, color: '#10b981', maxValue: totalStok || 10000 },
      { label: 'Permintaan Aktif', value: permintaanAktif, icon: <SendIcon sx={{ fontSize: 22 }} />, color: '#f59e0b', maxValue: permintaanAktif || 100 },
      { label: 'Total Transaksi', value: barangMasukList.length, icon: <DownloadIcon sx={{ fontSize: 22 }} />, color: '#06b6d4', maxValue: barangMasukList.length || 100 },
    ];
  };

  const TabButton = ({ idx, label }) => (
    <button
      onClick={() => setTab(idx)}
      style={{
        padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
        fontSize: '0.85rem', transition: 'all 0.2s',
        background: tab === idx ? '#3b82f6' : 'transparent',
        color: tab === idx ? '#fff' : '#64748b',
        boxShadow: tab === idx ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
      }}
    >
      {label}
    </button>
  );

  return (
    <PolishedPageShell
      title="Manajemen Persediaan"
      subtitle="Kelola stok barang, barang masuk, permintaan, dan stok opname"
      statistics={getStatCards()}
      actions={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAll} disabled={loading}
            sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.08)' } }}>
            Refresh
          </Button>
          {tab === 0 && isPicGudang && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreateModal('create')}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Tambah Barang
            </Button>
          )}
          {tab === 1 && isPicGudang && (
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setBmModalOpen(true)}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Barang Masuk
            </Button>
          )}
          {tab === 2 && isPicPersediaan && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setPermintaanModalOpen(true)}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Request Barang
            </Button>
          )}
          {tab === 3 && (isPicGudang || isKabagTu) && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpnameModalOpen(true)}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Stok Opname
            </Button>
          )}
        </Box>
      }
    >
      {/* TABS */}
      <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {tabs.map((t, i) => {
          // Badge untuk tab Permintaan
          const pendingCount = i === 2 ? permintaanList.filter(g => {
            if (isKatim) return g.status === 'menunggu_katim' || g.status === 'diajukan';
            if (isKabagTu) return g.status === 'disetujui_katim';
            if (isPicGudang) return g.status === 'disetujui_kabag';
            return false;
          }).length : 0;
          return (
            <Box key={i} sx={{ position: 'relative' }}>
              <TabButton idx={i} label={t} />
              {pendingCount > 0 && (
                <Box sx={{
                  position: 'absolute', top: -6, right: -8,
                  bgcolor: '#ef4444', color: '#fff',
                  borderRadius: '50%', minWidth: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
                  px: pendingCount > 9 ? 0.6 : 0,
                }}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ==================== TAB 0: BARANG ==================== */}
      {tab === 0 && (
        <Fade in>
          <Box>
            <FilterSection
              filters={filters}
              onFilterChange={(f) => { setFilters(f); setPagination(prev => ({ ...prev, currentPage: 1 })); }}
              session={session}
              onImportXLSX={handleImportXLSX}
              onDownloadTemplate={handleDownloadTemplate}
            />
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.8rem', color: '#64748b' } }}>
                    <TableCell>Nama Barang</TableCell>
                    <TableCell>Jenis</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Satuan</TableCell>
                    <TableCell align="right">Stok</TableCell>
                    {(isPicGudang) && <TableCell align="center">Aksi</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {barangList.map((b) => (
                    <TableRow key={b.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell><Typography fontWeight={500}>{b.nama_barang}</Typography></TableCell>
                      <TableCell>{b.jenis}</TableCell>
                      <TableCell>{b.kategori}</TableCell>
                      <TableCell>{b.satuan}</TableCell>
                      <TableCell align="right">
                        <Chip label={b.saldo || 0} size="small"
                          color={(b.saldo || 0) > 0 ? 'success' : 'error'}
                          sx={{ fontWeight: 600, minWidth: 50 }} />
                      </TableCell>
                      {(isPicGudang) && (
                        <TableCell align="center">
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditModal(b)}
                            sx={{ color: '#3b82f6' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Hapus"><IconButton size="small" onClick={() => handleDeleteBarang(b.id)}
                            sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {barangList.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada data barang</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={pagination.total || 0}
                page={(pagination.currentPage || 1) - 1}
                onPageChange={handleChangePage}
                rowsPerPage={pagination.perPage || 10}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Baris/hal"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
              />
            </TableContainer>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 1: BARANG MASUK ==================== */}
      {tab === 1 && (
        <Fade in>
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.8rem', color: '#64748b' } }}>
                  <TableCell>Nota / Kuitansi</TableCell>
                  <TableCell>Barang</TableCell>
                  <TableCell align="right">Jumlah</TableCell>
                  <TableCell>Pengaju</TableCell>                    <TableCell>Tgl Beli</TableCell>                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  // Group by kuitansi_url
                  const groups = {};
                  barangMasukList.forEach(b => {
                    const key = b.kuitansi_url || '__no_kuitansi__';
                    if (!groups[key]) groups[key] = { kuitansi_url: b.kuitansi_url, items: [], created_by: b.created_by };
                    groups[key].items.push(b);
                  });
                  return Object.entries(groups).map(([key, group]) => {
                    const itemStatuses = group.items.map(i => i.status);
                    const disetujuiCount = itemStatuses.filter(s => s === 'disetujui').length;
                    const ditolakCount = itemStatuses.filter(s => s === 'ditolak').length;
                    const diajukanCount = itemStatuses.filter(s => s === 'diajukan').length;
                    const uniqueStatuses = [...new Set(itemStatuses)];

                    let groupStatusChip = null;
                    if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'disetujui') {
                      groupStatusChip = <Chip label="✅ Semua Masuk Stok" size="small" color="success" />;
                    } else if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'ditolak') {
                      groupStatusChip = <Chip label="❌ Semua Ditolak" size="small" color="error" />;
                    } else if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'diajukan') {
                      groupStatusChip = <Chip label="⏳ Menunggu" size="small" color="warning" />;
                    } else if (uniqueStatuses.length > 1) {
                      // Mixed statuses
                      const parts = [];
                      if (disetujuiCount > 0) parts.push(`✅ ${disetujuiCount} disetujui`);
                      if (ditolakCount > 0) parts.push(`❌ ${ditolakCount} ditolak`);
                      if (diajukanCount > 0) parts.push(`⏳ ${diajukanCount} menunggu`);
                      groupStatusChip = (
                        <Chip label={parts.join(' · ')} size="small" color="warning"
                          sx={{ fontWeight: 500, '& .MuiChip-label': { fontSize: '0.7rem' } }} />
                      );
                    }
                    return (
                      <React.Fragment key={key}>
                        {/* Group header row */}
                        <TableRow sx={{ bgcolor: '#f1f5f9', '& td': { borderBottom: 'none', py: 1 } }}>
                          <TableCell colSpan={6}>
                            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                              {group.kuitansi_url ? (
                                <a href={group.kuitansi_url.startsWith('/uploads') ? `${api.BACKEND_HOST}${group.kuitansi_url}` : group.kuitansi_url} target="_blank" rel="noreferrer">
                                  <Chip icon={<DownloadIcon />} label="Lihat Nota" size="small" clickable color="primary" variant="outlined" />
                                </a>
                              ) : <Chip label="Tanpa Nota" size="small" />}
                              <Typography variant="caption" color="text.secondary">
                                {group.items.length} barang · {group.created_by}
                              </Typography>
                              {groupStatusChip}
                            </Box>
                          </TableCell>
                        </TableRow>
                        {/* Item rows */}
                        {group.items.map((b) => (
                          <TableRow key={b.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                            <TableCell></TableCell>
                            <TableCell>{b.nama_barang}</TableCell>
                            <TableCell align="right"><Typography fontWeight={600}>{b.jumlah} {b.satuan}</Typography></TableCell>
                            <TableCell>{b.created_by}</TableCell>
                            <TableCell>
                              {b.tanggal_pembelian ? (
                                <Typography variant="body2">{b.tanggal_pembelian?.split('T')[0]}</Typography>
                              ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                            </TableCell>
                            <TableCell>
                              <Chip label={statusLabels[b.status] || b.status} size="small"
                                color={statusColors[b.status] || 'default'} sx={{ fontWeight: 500 }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  });
                })()}
                {barangMasukList.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada barang masuk</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={bmPagination.total || 0}
              page={(bmPagination.currentPage || 1) - 1}
              onPageChange={handleBmChangePage}
              rowsPerPage={bmPagination.perPage || 10}
              onRowsPerPageChange={handleBmChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage="Baris/hal"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
            />
          </TableContainer>
        </Fade>
      )}

      {/* ==================== TAB 2: PERMINTAAN (Grouped by group_id) ==================== */}
      {tab === 2 && (
        <Fade in>
          <Box>
            {/* Notification alerts per role */}
            {(() => {
              const needsKatim = permintaanList.filter(g => g.status === 'menunggu_katim' || g.status === 'diajukan');
              const needsKabag = permintaanList.filter(g => g.status === 'disetujui_katim');
              const needsGudang = permintaanList.filter(g => g.status === 'disetujui_kabag');
              const alerts = [];
              if (isKatim && needsKatim.length > 0)
                alerts.push({ severity: 'warning', msg: `🔔 ${needsKatim.length} permintaan menunggu persetujuan Anda (Katim)` });
              if (isKabagTu && needsKabag.length > 0)
                alerts.push({ severity: 'info', msg: `🔔 ${needsKabag.length} permintaan telah disetujui Katim, menunggu persetujuan Anda (Kabag TU)` });
              if (isPicGudang && needsGudang.length > 0)
                alerts.push({ severity: 'success', msg: `🔔 ${needsGudang.length} permintaan siap diproses (PIC Gudang)` });
              return alerts.map((a, i) => (
                <Alert key={i} severity={a.severity} sx={{ mb: 1.5 }}>{a.msg}</Alert>
              ));
            })()}

          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.8rem', color: '#64748b' } }}>
                  <TableCell width={40}></TableCell>
                  <TableCell>Tanggal</TableCell>
                  <TableCell>PIC Persediaan</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>Catatan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {permintaanList.map((group) => {
                  const isExpanded = expandedPermintaan[group.group_id];
                  const allDraft = group.items.every(i => i.status === 'draft' || !i.status);
                  return (
                    <React.Fragment key={group.group_id}>
                      {/* Header row */}
                      <TableRow hover sx={{ '&:last-child td': { border: 0 }, bgcolor: isExpanded ? '#f1f5f9' : 'inherit', cursor: 'pointer' }}
                        onClick={() => setExpandedPermintaan(prev => ({ ...prev, [group.group_id]: !prev[group.group_id] }))}>
                        <TableCell>
                          {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {formatDateForDisplay(group.tanggal_permintaan)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{group.requested_by || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {group.items.length} barang
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {group.items.map(i => i.nama_barang).join(', ')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {group.catatan || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {group.status === 'diserahkan_sebagian' ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                              <Chip label={`✅ ${group.diserahkan_count} barang`} size="small" color="success" sx={{ fontWeight: 500, fontSize: '0.7rem' }} />
                              <Chip label={`❌ ${group.ditolak_count} barang`} size="small" color="error" sx={{ fontWeight: 500, fontSize: '0.7rem' }} />
                            </Box>
                          ) : (
                            <Chip label={statusLabels[group.status] || group.status || 'Draft'} size="small"
                              color={statusColors[group.status] || 'default'} sx={{ fontWeight: 500 }} />
                          )}
                        </TableCell>
                        <TableCell align="center" onClick={e => e.stopPropagation()}>
                          {allDraft && isPicPersediaan && (
                            <>
                              <Tooltip title="Kirim ke Katim">
                                <IconButton size="small" onClick={() => setKatimModal({ open: true, groupId: group.group_id, itemCount: group.items.length })}
                                  sx={{ color: '#3b82f6' }}><SendIcon fontSize="small" /></IconButton>
                              </Tooltip>
                              <Tooltip title="Hapus">
                                <IconButton size="small" onClick={() => handleDeletePermintaan(group.group_id)}
                                  sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            </>
                          )}
                          {(group.status === 'diajukan' || group.status === 'menunggu_katim') && isKatim && (
                            <>
                              <Tooltip title="Setujui"><IconButton size="small" onClick={async () => { const r = await api.approvePermintaanKatim(session, group.group_id); if (r.success) { showSnackbar(r.message); fetchAll(); } }} sx={{ color: '#10b981' }}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Tolak"><IconButton size="small" onClick={() => handleReject(group.group_id)} sx={{ color: '#ef4444' }}><CancelIcon fontSize="small" /></IconButton></Tooltip>
                            </>
                          )}
                          {group.status === 'disetujui_katim' && isKabagTu && (
                            <>
                              <Tooltip title="Setujui"><IconButton size="small" onClick={async () => { const r = await api.approvePermintaanKabag(session, group.group_id); if (r.success) { showSnackbar(r.message); fetchAll(); } }} sx={{ color: '#10b981' }}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Tolak"><IconButton size="small" onClick={() => handleReject(group.group_id)} sx={{ color: '#ef4444' }}><CancelIcon fontSize="small" /></IconButton></Tooltip>
                            </>
                          )}
                          {group.status === 'disetujui_kabag' && isPicGudang && (
                            <>
                              <Tooltip title="Proses Penyerahan">
                                <IconButton size="small" onClick={() => setProsesModal({ open: true, group })}
                                  sx={{ color: '#3b82f6' }}><AssignmentIcon fontSize="small" /></IconButton>
                              </Tooltip>
                              <Tooltip title="Tolak Semua">
                                <IconButton size="small" onClick={() => handleReject(group.group_id, 'Stok tidak mencukupi')}
                                  sx={{ color: '#ef4444' }}><CancelIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            </>
                          )}
                          {/* Status info */}
                          {group.status === 'menunggu_katim' && group.katim_nama && <Typography variant="caption" display="block" color="text.secondary">✉️ Dikirim ke: {group.katim_nama}</Typography>}
                          {group.status === 'disetujui_katim' && group.approved_katim_by && <Typography variant="caption" display="block" color="success.main">✅ Disetujui Katim: {group.approved_katim_by}</Typography>}
                          {group.status === 'disetujui_katim' && <Typography variant="caption" display="block" color="text.secondary">➡️ Diteruskan ke Kabag TU</Typography>}
                          {group.status === 'disetujui_kabag' && group.approved_kabag_by && <Typography variant="caption" display="block" color="success.main">✅ Disetujui Kabag: {group.approved_kabag_by}</Typography>}
                          {group.status === 'disetujui_kabag' && <Typography variant="caption" display="block" color="text.secondary">➡️ Diteruskan ke PIC Gudang</Typography>}

                          {group.status === 'diserahkan' && group.delivered_by && <Typography variant="caption" display="block" color="success.main">✅ Diserahkan oleh: {group.delivered_by}</Typography>}
                          {group.status === 'diserahkan_sebagian' && (
                            <Typography variant="caption" display="block" color="warning.dark">
                              ✅ Diserahkan: {group.diserahkan_count} barang | ❌ Ditolak: {group.ditolak_count} barang
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Detail items (expandable) */}
                      {isExpanded && group.items.map((item, idx) => (
                        <TableRow key={item.id || idx} sx={{ bgcolor: '#fafbfc', '& td': { borderTop: 'none' } }}>
                          <TableCell></TableCell>
                          <TableCell colSpan={2}>
                            <Typography variant="caption" color="text.disabled">Detail item</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{item.nama_barang}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.jumlah} {item.satuan}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={statusLabels[item.status] || item.status} size="small"
                              color={statusColors[item.status] || 'default'} sx={{ fontWeight: 500, fontSize: '0.65rem' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">{item.catatan_item || '-'}</Typography>
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
                {permintaanList.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada permintaan</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 3: STOK OPNAME ==================== */}
      {tab === 3 && (
        <Fade in>
          <Box>
            {/* Filter & Search & Export */}
            <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                <TextField size="small" label="Cari barang..." value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  sx={{ minWidth: 200 }} />
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  Filter Tanggal Mutasi:
                </Typography>
                <TextField type="date" size="small" label="Dari" value={mutasiDateRange.mulai}
                  onChange={(e) => setMutasiDateRange(prev => ({ ...prev, mulai: e.target.value }))}
                  InputLabelProps={{ shrink: true }} sx={{ maxWidth: 180 }} />
                <TextField type="date" size="small" label="Sampai" value={mutasiDateRange.akhir}
                  onChange={(e) => setMutasiDateRange(prev => ({ ...prev, akhir: e.target.value }))}
                  InputLabelProps={{ shrink: true }} sx={{ maxWidth: 180 }} />
                {(filters.search || mutasiDateRange.mulai || mutasiDateRange.akhir) && (
                  <Button size="small" color="error" variant="text"
                    onClick={() => { setFilters(prev => ({ ...prev, search: '' })); setMutasiDateRange({ mulai: '', akhir: '' }); }}>
                    Reset
                  </Button>
                )}
                <Button variant="contained" size="small" startIcon={<DownloadIcon />}
                  onClick={async () => {
                    try {
                      const blob = await api.exportMutasi(session);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `mutasi-stok-${new Date().getFullYear()}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (e) {
                      showSnackbar('Gagal export: ' + (e.response?.data?.message || e.message), 'error');
                    }
                  }}
                  sx={{ ml: 'auto', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
                  Export XLSX
                </Button>
              </Box>
            </Paper>

            {/* All Items with Stock & Mutasi */}
            <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
              Mutasi Stok Barang
              {mutasiDateRange.mulai && <Chip size="small" label={`Periode: ${mutasiDateRange.mulai} s/d ${mutasiDateRange.akhir || 'sekarang'}`} sx={{ ml: 1 }} />}
            </Typography>
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', mb: 4 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.78rem', color: '#64748b' } }}>
                    <TableCell>Barang</TableCell>
                    <TableCell>Satuan</TableCell>
                    <TableCell align="right">Stok Awal</TableCell>
                    <TableCell align="right" sx={{ color: '#10b981' }}>Masuk</TableCell>
                    <TableCell align="right" sx={{ color: '#ef4444' }}>Keluar</TableCell>
                    <TableCell align="right">Stok Akhir</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mutasiList
                    .filter(b => !filters.search || b.nama_barang.toLowerCase().includes(filters.search.toLowerCase()))
                    .slice(mutasiPage * mutasiRowsPerPage, mutasiPage * mutasiRowsPerPage + mutasiRowsPerPage)
                    .map((b) => (
                    <TableRow key={b.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell>
                        <Typography fontWeight={500} variant="body2">{b.nama_barang}</Typography>
                        <Typography variant="caption" color="text.secondary">{b.jenis} {b.kategori && `· ${b.kategori}`}</Typography>
                      </TableCell>
                      <TableCell>{b.satuan}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>{b.stok_awal}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {b.masuk > 0 ? (
                          <Chip label={`+${b.masuk}`} size="small" color="success" variant="outlined"
                            onClick={() => openHistory(b, 'masuk')}
                            sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { filter: 'brightness(0.9)' } }} />
                        ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        {b.keluar > 0 ? (
                          <Chip label={`-${b.keluar}`} size="small" color="error" variant="outlined"
                            onClick={() => openHistory(b, 'keluar')}
                            sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { filter: 'brightness(0.9)' } }} />
                        ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Chip label={b.stok_akhir} size="small"
                          color={b.stok_akhir > 0 ? 'success' : b.stok_akhir === 0 ? 'default' : 'error'}
                          sx={{ fontWeight: 700, minWidth: 50 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {mutasiList.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94a3b8' }}>Tidak ada data barang</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={mutasiList.filter(b => !filters.search || b.nama_barang.toLowerCase().includes(filters.search.toLowerCase())).length}
                page={mutasiPage}
                onPageChange={(e, p) => setMutasiPage(p)}
                rowsPerPage={mutasiRowsPerPage}
                onRowsPerPageChange={(e) => { setMutasiRowsPerPage(parseInt(e.target.value, 10)); setMutasiPage(0); }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Baris/hal"
              />
            </TableContainer>

            {/* Riwayat Opname */}
            <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Riwayat Stok Opname</Typography>
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.78rem', color: '#64748b' } }}>
                    <TableCell>Tanggal</TableCell>
                    <TableCell>Barang</TableCell>
                    <TableCell align="right">Stok Sistem</TableCell>
                    <TableCell align="right">Stok Nyata</TableCell>
                    <TableCell align="right">Selisih</TableCell>
                    <TableCell>Catatan</TableCell>
                    <TableCell>Oleh</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {opnameList.slice(opnamePage * opnameRowsPerPage, opnamePage * opnameRowsPerPage + opnameRowsPerPage).map((o) => (
                    <TableRow key={o.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell>{o.tanggal?.split('T')[0]}</TableCell>
                      <TableCell>{o.nama_barang}</TableCell>
                      <TableCell align="right">{o.stok_sistem}</TableCell>
                      <TableCell align="right">{o.stok_nyata}</TableCell>
                      <TableCell align="right">
                        <Chip label={`${o.selisih >= 0 ? '+' : ''}${o.selisih}`} size="small"
                          color={o.selisih > 0 ? 'success' : o.selisih < 0 ? 'error' : 'default'}
                          sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{o.catatan || '-'}</Typography></TableCell>
                      <TableCell>{o.created_by}</TableCell>
                    </TableRow>
                  ))}
                  {opnameList.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada opname</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={opnameList.length}
                page={opnamePage}
                onPageChange={(e, p) => setOpnamePage(p)}
                rowsPerPage={opnameRowsPerPage}
                onRowsPerPageChange={(e) => { setOpnameRowsPerPage(parseInt(e.target.value, 10)); setOpnamePage(0); }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Baris/hal"
              />
            </TableContainer>
          </Box>
        </Fade>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Modal Barang */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{modalMode === 'create' ? 'Tambah Barang' : 'Edit Barang'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Nama Barang" fullWidth required value={formData.nama_barang || ''}
              onChange={(e) => setFormData({ ...formData, nama_barang: e.target.value })} />
            <TextField label="Jenis" fullWidth value={formData.jenis || ''}
              onChange={(e) => setFormData({ ...formData, jenis: e.target.value })} />
            <TextField label="Kategori" fullWidth value={formData.kategori || ''}
              onChange={(e) => setFormData({ ...formData, kategori: e.target.value })} />
            <TextField label="Satuan" fullWidth required value={formData.satuan || ''}
              onChange={(e) => setFormData({ ...formData, satuan: e.target.value })} placeholder="contoh: pcs, box, kg" />
            {modalMode === 'create' && (
              <TextField label="Saldo Awal" type="number" fullWidth value={formData.saldo_awal || ''}
                onChange={(e) => setFormData({ ...formData, saldo_awal: e.target.value })}
                helperText="Isi jika ingin langsung mengisi stok awal (opsional)" />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitBarang}>Simpan</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Barang Masuk — Batch + Upload Nota */}
      <Dialog open={bmModalOpen} onClose={() => setBmModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <UploadIcon color="primary" />
            Barang Masuk — Upload Nota & Input Barang
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Upload Nota */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed', borderColor: '#cbd5e1' }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>1. Upload Nota / Kuitansi</Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Button variant="contained" component="label" disabled={bmUploading}>
                  {bmUploading ? 'Mengupload...' : 'Pilih File'}
                  <input type="file" hidden accept="image/*,.pdf" onChange={(e) => { if (e.target.files[0]) handleBmFileUpload(e.target.files[0]); e.target.value = ''; }} />
                </Button>
                {bmUploading && <CircularProgress size={20} />}
                {bmKuitansiUrl && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip icon={<CheckCircleIcon />} label="Nota terupload" color="success" size="small" />
                    <a href={bmKuitansiUrl} target="_blank" rel="noreferrer">
                      <Button size="small" startIcon={<DownloadIcon />}>Lihat</Button>
                    </a>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Tanggal Pembelian (satu untuk semua barang dalam nota) */}
            <Typography variant="subtitle2" fontWeight={600}>2. Tanggal Pembelian</Typography>
            <TextField label="Tanggal Pembelian" type="date" size="small" sx={{ maxWidth: 220 }}
              value={bmTanggalPembelian}
              onChange={(e) => setBmTanggalPembelian(e.target.value)}
              InputLabelProps={{ shrink: true }} />

            {/* Daftar Barang */}
            <Typography variant="subtitle2" fontWeight={600}>3. Daftar Barang</Typography>
            {bmItems.map((item, idx) => (
              <Box key={idx} display="flex" gap={1} alignItems="center">
                <TextField select label={`Barang ${idx + 1}`} size="small" sx={{ flex: 2 }}
                  value={item.barang_id}
                  onChange={(e) => handleBmItemChange(idx, 'barang_id', e.target.value)}>
                  {allBarang.map((b) => (
                    <MenuItem key={b.id} value={b.id}>{b.nama_barang} (stok: {b.saldo || 0} {b.satuan})</MenuItem>
                  ))}
                </TextField>
                <TextField label="Jumlah" type="number" size="small" sx={{ flex: 0.5 }}
                  value={item.jumlah}
                  onChange={(e) => handleBmItemChange(idx, 'jumlah', e.target.value)} />
                <TextField label="Catatan" size="small" sx={{ flex: 1.5 }}
                  value={item.catatan}
                  onChange={(e) => handleBmItemChange(idx, 'catatan', e.target.value)} />
                <IconButton size="small" onClick={() => handleBmRemoveItem(idx)}
                  disabled={bmItems.length <= 1} sx={{ color: '#ef4444' }}>
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button startIcon={<AddIcon />} size="small" onClick={handleBmAddItem}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
              Tambah Barang Lain
            </Button>

            {/* Catatan Global */}
            <TextField label="Catatan Global (opsional)" multiline rows={2} fullWidth value={bmCatatan}
              onChange={(e) => setBmCatatan(e.target.value)}
              helperText="Catatan ini akan berlaku untuk semua barang dalam nota ini" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBmModalOpen(false); setBmFile(null); setBmKuitansiUrl(''); setBmItems([{ barang_id: '', jumlah: '', catatan: '' }]); setBmCatatan(''); setBmTanggalPembelian(''); }}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitBarangMasuk}
            disabled={!bmKuitansiUrl || bmItems.every(i => !i.barang_id || !i.jumlah)}
            startIcon={<CheckCircleIcon />}>
            Simpan & Tambah Stok
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Permintaan — multi item (max 5) */}
      <Dialog open={permintaanModalOpen} onClose={() => setPermintaanModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Request Barang
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
            {permintaanItems.length}/5 item — satu kali kirim
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Tanggal permintaan */}
            <TextField label="Tanggal Permintaan" type="date" fullWidth required size="small"
              value={permintaanTanggal}
              onChange={(e) => setPermintaanTanggal(e.target.value)}
              InputLabelProps={{ shrink: true }} />

            {/* Items */}
            {permintaanItems.map((item, idx) => (
              <Box key={idx} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Item #{idx + 1}</Typography>
                  {permintaanItems.length > 1 && (
                    <IconButton size="small" onClick={() => removePermintaanItem(idx)} sx={{ ml: 'auto', color: '#ef4444' }}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField select label="Pilih Barang" fullWidth required size="small" value={item.barang_id}
                    onChange={(e) => updatePermintaanItem(idx, 'barang_id', e.target.value)}
                    sx={{ flex: 2 }}>
                    {allBarang.filter(b => (b.saldo || 0) > 0).map((b) => (
                      <MenuItem key={b.id} value={b.id}>{b.nama_barang} (stok: {b.saldo} {b.satuan})</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Jumlah" type="number" required size="small" value={item.jumlah}
                    onChange={(e) => updatePermintaanItem(idx, 'jumlah', e.target.value)}
                    sx={{ flex: 1, minWidth: 100 }} />
                </Box>
                <TextField label="Catatan item (opsional)" multiline rows={1} fullWidth size="small"
                  value={item.catatan} sx={{ mt: 1 }}
                  onChange={(e) => updatePermintaanItem(idx, 'catatan', e.target.value)} />
              </Box>
            ))}
            {permintaanItems.length < 5 && (
              <Button startIcon={<AddIcon />} onClick={addPermintaanItem} size="small" sx={{ alignSelf: 'flex-start' }}>
                Tambah Item
              </Button>
            )}
            <TextField label="Catatan Umum (opsional)" multiline rows={2} fullWidth value={permintaanCatatan}
              onChange={(e) => setPermintaanCatatan(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPermintaanModalOpen(false); setPermintaanItems([{ barang_id: '', jumlah: '', catatan: '' }]); setPermintaanCatatan(''); setPermintaanTanggal(new Date().toISOString().split('T')[0]); }}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitPermintaan}
            disabled={permintaanItems.every(i => !i.barang_id || !i.jumlah)}>
            Ajukan ({permintaanItems.filter(i => i.barang_id && i.jumlah).length} item)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Stok Opname */}
      <Dialog open={opnameModalOpen} onClose={() => setOpnameModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Stok Opname</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField select label="Pilih Barang" fullWidth required value={opnameForm.barang_id}
              onChange={(e) => setOpnameForm({ ...opnameForm, barang_id: e.target.value })}>
              {allBarang.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.nama_barang} (stok sistem: {b.saldo || 0} {b.satuan})</MenuItem>
              ))}
            </TextField>
            <TextField label="Stok Nyata (hasil hitung fisik)" type="number" fullWidth required value={opnameForm.stok_nyata}
              onChange={(e) => setOpnameForm({ ...opnameForm, stok_nyata: e.target.value })} />
            <TextField label="Tanggal" type="date" fullWidth required value={opnameForm.tanggal}
              onChange={(e) => setOpnameForm({ ...opnameForm, tanggal: e.target.value })}
              InputLabelProps={{ shrink: true }} />
            <TextField label="Catatan" multiline rows={2} fullWidth value={opnameForm.catatan}
              onChange={(e) => setOpnameForm({ ...opnameForm, catatan: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpnameModalOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitOpname}>Simpan Opname</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={confirmDialog.open}
        title="Konfirmasi Hapus"
        message={confirmDialog.message}
        confirmLabel="Hapus"
        onClose={() => setConfirmDialog({ open: false, message: '', onConfirm: null })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        loading={confirmDialog.loading}
      />

      {/* Dialog Alasan Ditolak */}
      <RejectDialog
        open={rejectDialog.open}
        title="Alasan Ditolak"
        onClose={() => setRejectDialog({ open: false, groupId: null, onConfirm: null })}
        onConfirm={rejectDialog.onConfirm || (async () => {})}
        loading={rejectDialog.loading}
      />

      {/* Modal Kirim ke Katim */}
      <KirimKeKatimModal
        open={katimModal.open}
        onClose={() => setKatimModal({ ...katimModal, open: false })}
        groupId={katimModal.groupId}
        itemCount={katimModal.itemCount}
        session={session}
        onSuccess={(msg) => { showSnackbar(msg); fetchAll(); }}
      />

      {/* Modal Proses Serahkan (PIC Gudang) */}
      <ProsesSerahkanModal
        open={prosesModal.open}
        onClose={() => setProsesModal({ ...prosesModal, open: false })}
        group={prosesModal.group}
        session={session}
        onSuccess={(msg) => { showSnackbar(msg); fetchAll(); }}
      />

      {/* Modal History */}
      <Dialog open={historyModal.open} onClose={() => setHistoryModal({ ...historyModal, open: false })} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{historyModal.title}</DialogTitle>
        <DialogContent>
          {historyModal.data.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Tidak ada transaksi</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.8rem' } }}>
                    <TableCell>Tanggal</TableCell>
                    <TableCell align="right">Jumlah</TableCell>
                    <TableCell>Keterangan</TableCell>
                    <TableCell>Oleh</TableCell>
                    {historyModal.jenis === 'masuk' && <TableCell>Nota</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyModal.data.map((item, idx) => (
                    <TableRow key={item.id || idx} hover>
                      <TableCell>{(item.tanggal_pembelian || item.tanggal || '').split('T')[0]}</TableCell>
                      <TableCell align="right">
                        <Chip label={`${item.tipe === 'masuk' ? '+' : '-'}${item.jumlah}`} size="small"
                          color={item.tipe === 'masuk' ? 'success' : 'error'} variant="outlined" sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell><Typography variant="body2">{item.catatan || '-'}</Typography></TableCell>
                      <TableCell>{item.created_by || item.requested_by || item.delivered_by || '-'}</TableCell>
                      {historyModal.jenis === 'masuk' && (
                        <TableCell>
                          {item.kuitansi_url ? (
                            <a href={item.kuitansi_url.startsWith('/uploads') ? `${api.BACKEND_HOST}${item.kuitansi_url}` : item.kuitansi_url} target="_blank" rel="noreferrer">
                              <Chip label="Lihat" size="small" clickable variant="outlined" />
                            </a>
                          ) : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryModal({ ...historyModal, open: false })}>Tutup</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ minWidth: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>{snackbar.message}</Alert>
      </Snackbar>
    </PolishedPageShell>
  );
};

export default PersediaanContainer;
