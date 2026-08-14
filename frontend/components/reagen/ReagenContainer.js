import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Alert, Snackbar, CircularProgress,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, Tooltip, LinearProgress,
  Fade, InputAdornment, TablePagination, Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon, Refresh as RefreshIcon, Edit as EditIcon,
  Delete as DeleteIcon, CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon, Inventory as InventoryIcon,
  Send as SendIcon, Upload as UploadIcon, Science as ScienceIcon,
  LocalShipping as LocalShippingIcon, ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon, EventBusy as EventBusyIcon,
  Download as DownloadIcon, Print as PrintIcon, CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import * as api from './api/reagenApi';
import PolishedPageShell from '../common/PolishedPageShell';
import ConfirmDialog from '../common/ConfirmDialog';
import RejectDialog from '../common/RejectDialog';
import KirimKeKatimModal from './modals/KirimKeKatimModal';
import ImportStokModal from './modals/ImportStokModal';
import { formatDateForDisplay } from '../../utils/formatters';
import { cetakSPBSBBK } from '../../utils/cetakSPBSBBK';

const statusColors = {
  draft: 'default',
  diajukan: 'warning',
  menunggu_katim: 'info',
  disetujui_katim: 'primary',
  disetujui_kabag: 'primary',
  diserahkan: 'success',
  ditolak: 'error',
  diserahkan_sebagian: 'warning',
  disetujui: 'success',
};

const statusLabels = {
  draft: 'Draft',
  diajukan: 'Diajukan',
  menunggu_katim: 'Menunggu Katim',
  disetujui_katim: 'Disetujui Katim',
  disetujui_kabag: 'Disetujui Kabag',
  diserahkan: 'Diserahkan ke Lab',
  ditolak: 'Ditolak',
  diserahkan_sebagian: 'Diserahkan Sebagian',
  disetujui: 'Disetujui',
};

const kategoriColors = {
  'Bahan Kimia Padat': 'primary',
  'Bahan Kimia Cair': 'info',
  'Bahan Kimia Lainnya': 'secondary',
};

const KATEGORI_OPTIONS = ['Bahan Kimia Padat', 'Bahan Kimia Cair', 'Bahan Kimia Lainnya'];

const LAB_OPTIONS = [
  { value: 'pangan', label: 'LAB Pangan' },
  { value: 'mikro', label: 'LAB Mikro' },
  { value: 'terano', label: 'LAB Terano' },
];
const LAB_COLORS = { pangan: 'success', mikro: 'info', terano: 'warning' };
const getLabLabel = (v) => LAB_OPTIONS.find(o => o.value === v)?.label || (v ? v : '-');

const isExpired = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

const isNearExpiry = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (d - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 90;
};

// Hook pagination client-side untuk tabel yang datanya diambil penuh dari backend
const useClientPagination = (data) => {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const totalPages = Math.max(1, Math.ceil((data?.length || 0) / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const from = safePage * perPage;
  const paged = (data || []).slice(from, from + perPage);
  const onChangePage = (e, newPage) => setPage(newPage);
  const onChangeRowsPerPage = (e) => { setPerPage(parseInt(e.target.value, 10)); setPage(0); };
  return { page: safePage, perPage, paged, total: data?.length || 0, onChangePage, onChangeRowsPerPage };
};

const ReagenContainer = ({ session, initialTab = 0, pageTitle, pageSubtitle }) => {
  const [tab, setTab] = useState(initialTab);
  const [labSubTab, setLabSubTab] = useState(0); // 0 = Persediaan Lab, 1 = Riwayat Pemakaian
  const tabs = ['Master Reagen', 'Stok Gudang', 'Barang Masuk', 'Permohonan Reagen', 'Persediaan & Pemakaian Lab', 'Stok Opname'];

  // Data states
  const [reagenList, setReagenList] = useState([]);
  const [allReagen, setAllReagen] = useState([]);
  const [stokGudang, setStokGudang] = useState([]);
  const [masukList, setMasukList] = useState([]);
  const [pengeluaranList, setPengeluaranList] = useState([]);
  const [labStok, setLabStok] = useState([]);
  const [pemakaianList, setPemakaianList] = useState([]);
  const [opnameList, setOpnameList] = useState([]);
  const [mutasiList, setMutasiList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: '', kategori: '', lab: '' });
  const [pagination, setPagination] = useState({ currentPage: 1, perPage: 10, total: 0, totalPages: 0 });
  const [labPagination, setLabPagination] = useState({ page: 0, perPage: 10 });
  const [expiryFilter, setExpiryFilter] = useState(''); // '', 'expired', 'near'
  const [mutasiDateRange, setMutasiDateRange] = useState({ mulai: '', akhir: '' });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, message: '', onConfirm: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, groupId: null, onConfirm: null });

  const showSnackbar = (msg, sev = 'success') => setSnackbar({ open: true, message: msg, severity: sev });

  const roles = session?.user?.realm_access?.roles || session?.user?.roles || [];
  const hasRole = (r) => roles.includes(r) || roles.includes('admin') || roles.includes('superadmin');
  const isPicGudang = hasRole('pic_gudang');
  const isPicLab = hasRole('pic_lab');
  const isPicPersediaan = hasRole('pic_persediaan');
  const isKatim = hasRole('katim');
  const isKabagTu = hasRole('kabag_tu');
  const isAdminPemeliharaan = hasRole('admin_pemeliharaan');
  const canManage = isPicGudang || isKabagTu;

  // Tab yang boleh dilihat per role:
  //  - pic_persediaan : Master Reagen, Stok Gudang
  //  - pic_lab        : Master Reagen, Stok Gudang, Permohonan Reagen, Persediaan & Pemakaian Lab
  //  - pic_gudang     : semua tab
  //  - katim/kabag_tu : mengikuti alur persetujuannya
  const canSeeTab = (i) => {
    if (i === 0) return isPicPersediaan || isPicLab || isPicGudang || isKatim || isKabagTu; // Master Reagen
    if (i === 1) return isPicPersediaan || isPicLab || isPicGudang || isKabagTu; // Stok Gudang
    if (i === 2) return isPicGudang || isKabagTu; // Barang Masuk
    if (i === 3) return isPicLab || isPicGudang || isKatim || isKabagTu; // Permohonan Reagen
    if (i === 4) return isPicLab || isPicGudang || isKatim; // Persediaan & Pemakaian Lab (termasuk Riwayat Pemakaian)
    if (i === 5) return isPicGudang || isKabagTu; // Stok Opname
    return true;
  };

  // ========== FETCH ==========
  const fetchAllReagenOptions = useCallback(async () => {
    if (!session) return [];
    try {
      const res = await api.fetchAllReagen(session);
      return res.success ? res.data : [];
    } catch { return []; }
  }, [session]);

  useEffect(() => { fetchAllReagenOptions().then(setAllReagen); }, [fetchAllReagenOptions]);

  const fetchAll = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const params = { page: pagination.currentPage, limit: pagination.perPage };
      if (filters.search) params.search = filters.search;
      if (filters.kategori) params.kategori = filters.kategori;

      const stokParams = {};
      if (filters.search) stokParams.search = filters.search;
      if (filters.kategori) stokParams.kategori = filters.kategori;

      const labParams = { ...stokParams };
      if (filters.lab) labParams.lab_tujuan = filters.lab;

      const opnameParams = {};
      if (mutasiDateRange.mulai) opnameParams.tanggal_mulai = mutasiDateRange.mulai;
      if (mutasiDateRange.akhir) opnameParams.tanggal_akhir = mutasiDateRange.akhir;

      const [reagen, stok, masuk, pengeluaran, lab, pemakaian, opname, mutasi] = await Promise.all([
        api.fetchReagen(session, params),
        api.fetchStokGudang(session, stokParams),
        api.fetchMasuk(session),
        api.fetchPengeluaran(session),
        api.fetchLabStok(session, labParams),
        api.fetchPemakaianLab(session, filters.lab ? { lab_tujuan: filters.lab } : {}),
        api.fetchOpname(session, opnameParams),
        api.fetchMutasiStok(session, opnameParams),
      ]);
      if (reagen.success) {
        setReagenList(reagen.data);
        if (reagen.pagination) setPagination(prev => ({ ...prev, ...reagen.pagination }));
      }
      if (stok.success) setStokGudang(stok.data);
      if (masuk.success) setMasukList(masuk.data);
      if (pengeluaran.success) setPengeluaranList(pengeluaran.data);
      if (lab.success) setLabStok(lab.data);
      if (pemakaian.success) setPemakaianList(pemakaian.data);
      if (opname.success) setOpnameList(opname.data);
      if (mutasi.success) setMutasiList(mutasi.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, filters, pagination.currentPage, pagination.perPage, mutasiDateRange.mulai, mutasiDateRange.akhir]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ========== PAGINATION ==========
  // Master reagen (server-side, sudah didukung backend)
  const handleMasterChangePage = (event, newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage + 1 }));
  };
  const handleMasterChangeRowsPerPage = (event) => {
    setPagination(prev => ({ ...prev, currentPage: 1, perPage: parseInt(event.target.value, 10) }));
  };

  // Persediaan lab (client-side, backend mengembalikan semua data)
  const labPaged = labStok.slice(labPagination.page * labPagination.perPage, labPagination.page * labPagination.perPage + labPagination.perPage);
  const handleLabChangePage = (event, newPage) => setLabPagination(prev => ({ ...prev, page: newPage }));
  const handleLabChangeRowsPerPage = (event) => setLabPagination(prev => ({ ...prev, page: 0, perPage: parseInt(event.target.value, 10) }));
  useEffect(() => { setLabPagination(prev => ({ ...prev, page: 0 })); }, [filters.lab]);

  // ========== MASTER CRUD ==========
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    kode_barang: '', no_urut: '', kategori: 'Bahan Kimia Padat',
    nama_barang: '', berat_volume: '', satuan_kemasan: 'Botol',
    kode_lama: '', satuan: 'Botol',
  });

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedItem(null);
    setFormData({ kode_barang: '', no_urut: '', kategori: 'Bahan Kimia Padat', nama_barang: '', berat_volume: '', satuan_kemasan: 'Botol', kode_lama: '', satuan: 'Botol' });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    setSelectedItem(item);
    setFormData({
      kode_barang: item.kode_barang || '',
      no_urut: item.no_urut || '',
      kategori: item.kategori || 'Bahan Kimia Padat',
      nama_barang: item.nama_barang || '',
      berat_volume: item.berat_volume || '',
      satuan_kemasan: item.satuan_kemasan || 'Botol',
      kode_lama: item.kode_lama || '',
      satuan: item.satuan || 'Botol',
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => setModalOpen(false);

  const handleSubmitReagen = async () => {
    if (!formData.nama_barang) { showSnackbar('Nama barang wajib diisi', 'warning'); return; }
    try {
      if (modalMode === 'create') {
        const res = await api.createReagen(session, formData);
        if (res.success) { showSnackbar(res.message); fetchAll(); handleCloseModal(); fetchAllReagenOptions().then(setAllReagen); }
        else showSnackbar(res.message, 'error');
      } else {
        const res = await api.updateReagen(session, selectedItem.id, formData);
        if (res.success) { showSnackbar(res.message); fetchAll(); handleCloseModal(); fetchAllReagenOptions().then(setAllReagen); }
        else showSnackbar(res.message, 'error');
      }
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const handleDeleteReagen = async (id) => {
    setConfirmDialog({
      open: true,
      message: 'Apakah Anda yakin ingin menghapus reagen ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.deleteReagen(session, id);
          if (res.success) { showSnackbar(res.message); fetchAll(); fetchAllReagenOptions().then(setAllReagen); }
        } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
        finally { setConfirmDialog({ open: false, message: '', onConfirm: null }); }
      }
    });
  };

  // ========== BARANG MASUK ==========
  const [masukOpen, setMasukOpen] = useState(false);
  const [masukUploading, setMasukUploading] = useState(false);
  const [masukForm, setMasukForm] = useState({ reagen_id: '', no_batch: '', jumlah_botol: '', tanggal_kadaluarsa: '', kuitansi_url: '', catatan: '', tanggal_pembelian: '' });

  const openMasukModal = () => {
    setMasukForm({ reagen_id: '', no_batch: '', jumlah_botol: '', tanggal_kadaluarsa: '', kuitansi_url: '', catatan: '', tanggal_pembelian: new Date().toISOString().split('T')[0] });
    setMasukUploading(false);
    setMasukOpen(true);
  };

  const handleMasukFileUpload = async (file) => {
    if (!file) return;
    setMasukUploading(true);
    try {
      const res = await api.uploadFile(session, file);
      if (res?.success && res.data?.[0]?.url) {
        const url = `${api.BACKEND_HOST}${res.data[0].url}`;
        setMasukForm(prev => ({ ...prev, kuitansi_url: url }));
        showSnackbar('File berhasil diupload', 'success');
      } else {
        showSnackbar('Gagal upload file', 'error');
      }
    } catch (e) {
      showSnackbar(e?.response?.data?.message || e.message, 'error');
    } finally {
      setMasukUploading(false);
    }
  };

  const handleSubmitMasuk = async () => {
    if (!masukForm.reagen_id || !masukForm.jumlah_botol) { showSnackbar('Reagen dan jumlah botol wajib diisi', 'warning'); return; }
    if (!masukForm.kuitansi_url) { showSnackbar('Upload nota/kuitansi terlebih dahulu', 'warning'); return; }
    try {
      const res = await api.createMasuk(session, { ...masukForm, jumlah_botol: parseInt(masukForm.jumlah_botol) });
      if (res.success) { showSnackbar(res.message); fetchAll(); setMasukOpen(false); }
      else showSnackbar(res.message, 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const handleDeleteMasuk = async (id) => {
    setConfirmDialog({
      open: true,
      message: 'Hapus barang masuk reagen ini? Stok gudang (botol) dan saldo akan dikembalikan.',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.deleteMasuk(session, id);
          if (res.success) { showSnackbar(res.message); fetchAll(); }
          else showSnackbar(res.message || 'Gagal', 'error');
        } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
        finally { setConfirmDialog({ open: false, message: '', onConfirm: null }); }
      }
    });
  };

  // ========== IMPORT STOK GUDANG (XLSX) ==========
  const [importStokOpen, setImportStokOpen] = useState(false);

  const handleDownloadTemplate = () => {
    window.open(api.downloadStokTemplateUrl, '_blank');
  };

  const handleImportStokSuccess = (message) => {
    fetchAll();
    showSnackbar(message || 'Import stok berhasil', 'success');
  };

  // ========== PENGELUARAN KE LAB ==========
  const [pengeluaranOpen, setPengeluaranOpen] = useState(false);
  const [pengeluaranItems, setPengeluaranItems] = useState([{ reagen_id: '', batch_id: '', jumlah_botol: '', catatan: '', lab_tujuan: 'pangan' }]);
  const [pengeluaranCatatan, setPengeluaranCatatan] = useState('');
  const [expandedPengeluaran, setExpandedPengeluaran] = useState({});
  const [katimModal, setKatimModal] = useState({ open: false, groupId: null, itemCount: 0 });

  const addPengeluaranItem = () => {
    if (pengeluaranItems.length >= 10) { showSnackbar('Maksimal 10 item', 'warning'); return; }
    setPengeluaranItems(prev => [...prev, { reagen_id: '', batch_id: '', jumlah_botol: '', catatan: '', lab_tujuan: 'pangan' }]);
  };
  const removePengeluaranItem = (idx) => {
    if (pengeluaranItems.length <= 1) return;
    setPengeluaranItems(prev => prev.filter((_, i) => i !== idx));
  };
  const updatePengeluaranItem = (idx, field, value) => {
    setPengeluaranItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSubmitPengeluaran = async () => {
    const validItems = pengeluaranItems.filter(i => i.reagen_id && i.jumlah_botol);
    if (validItems.length === 0) { showSnackbar('Pilih minimal 1 reagen', 'warning'); return; }
    try {
      const res = await api.createPengeluaran(session, { items: validItems.map(i => ({ ...i, jumlah_botol: parseInt(i.jumlah_botol) })), catatan: pengeluaranCatatan });
      if (res.success) {
        showSnackbar(res.message);
        fetchAll();
        setPengeluaranOpen(false);
        setPengeluaranItems([{ reagen_id: '', batch_id: '', jumlah_botol: '', catatan: '', lab_tujuan: 'pangan' }]);
        setPengeluaranCatatan('');
      } else showSnackbar(res.message, 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const handleSerahkan = async (groupId) => {
    setConfirmDialog({
      open: true,
      message: 'Serahkan reagen ke Lab? Stok gudang (botol) akan berkurang dan persediaan LAB (per gram/mL) bertambah.',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.serahkanPengeluaran(session, groupId);
          if (res.success) { showSnackbar(res.message); fetchAll(); }
          else showSnackbar(res.message || 'Gagal', 'error');
        } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
        finally { setConfirmDialog({ open: false, message: '', onConfirm: null }); }
      }
    });
  };

  const handleTolakPengeluaran = (groupId, defaultAlasan = '') => {
    setRejectDialog({
      open: true,
      groupId,
      onConfirm: async (alasan) => {
        const r = await api.tolakPengeluaran(session, groupId, alasan || defaultAlasan);
        if (r.success) { showSnackbar(r.message); fetchAll(); }
        setRejectDialog({ open: false, groupId: null, onConfirm: null });
      }
    });
  };

  const handleDeletePengeluaran = async (groupId) => {
    setConfirmDialog({
      open: true,
      message: 'Hapus pengeluaran ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await api.deletePengeluaran(session, groupId);
          if (res.success) { showSnackbar(res.message); fetchAll(); }
        } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
        finally { setConfirmDialog({ open: false, message: '', onConfirm: null }); }
      }
    });
  };

  // ========== PEMAKAIAN LAB ==========
  const [pemakaianModal, setPemakaianModal] = useState({ open: false, labStokItem: null });
  const [pemakaianForm, setPemakaianForm] = useState({ jumlah: '', tanggal: '', catatan: '' });

  const openPemakaian = (item) => {
    setPemakaianModal({ open: true, labStokItem: item });
    setPemakaianForm({ jumlah: '', tanggal: new Date().toISOString().split('T')[0], catatan: '' });
  };

  const handleSubmitPemakaian = async () => {
    const { labStokItem } = pemakaianModal;
    if (!labStokItem) return;
    try {
      const res = await api.createPemakaianLab(session, {
        lab_stok_id: labStokItem.id,
        jumlah: parseFloat(pemakaianForm.jumlah),
        tanggal: pemakaianForm.tanggal,
        catatan: pemakaianForm.catatan,
      });
      if (res.success) { showSnackbar(res.message); fetchAll(); setPemakaianModal({ open: false, labStokItem: null }); }
      else showSnackbar(res.message, 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  // ========== STOK OPNAME (GUDANG / BOTOL) ==========
  const todayStr = typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : '';
  const [opnameModalOpen, setOpnameModalOpen] = useState(false);
  const [opnameForm, setOpnameForm] = useState({ reagen_id: '', stok_nyata: '', tanggal: todayStr, catatan: '' });
  const [opnamePage, setOpnamePage] = useState(0);
  const [opnameRowsPerPage, setOpnameRowsPerPage] = useState(10);
  const [mutasiPage, setMutasiPage] = useState(0);
  const [mutasiRowsPerPage, setMutasiRowsPerPage] = useState(10);
  const [historyModal, setHistoryModal] = useState({ open: false, data: [], title: '', jenis: '' });

  const openOpnameModal = () => {
    setOpnameForm({ reagen_id: '', stok_nyata: '', tanggal: todayStr, catatan: '' });
    setOpnameModalOpen(true);
  };

  const handleSubmitOpname = async () => {
    try {
      const res = await api.createOpname(session, opnameForm);
      if (res.success) {
        showSnackbar(res.message);
        fetchAll();
        setOpnameModalOpen(false);
        setOpnameForm({ reagen_id: '', stok_nyata: '', tanggal: todayStr, catatan: '' });
      } else showSnackbar(res.message, 'error');
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  const openHistory = async (item, jenis) => {
    try {
      const params = { jenis };
      if (mutasiDateRange.mulai) params.tanggal_mulai = mutasiDateRange.mulai;
      if (mutasiDateRange.akhir) params.tanggal_akhir = mutasiDateRange.akhir;
      const res = await api.fetchMutasiDetail(session, item.id, params);
      if (res.success) {
        setHistoryModal({ open: true, data: res.data, title: `${item.nama_barang} — ${jenis === 'masuk' ? 'Barang Masuk' : 'Barang Keluar'}`, jenis });
      }
    } catch (e) { showSnackbar(e?.response?.data?.message || e.message, 'error'); }
  };

  // ========== STATS ==========
  const getStatCards = () => {
    const totalReagen = allReagen.length || pagination.total || reagenList.length;
    const totalBotol = allReagen.reduce((s, r) => s + (Number(r.saldo_botol) || 0), 0);
    const expiredCount = stokGudang.reduce((s, g) => s + g.batches.filter(b => isExpired(b.tanggal_kadaluarsa)).length, 0);
    const nearExp = stokGudang.reduce((s, g) => s + g.batches.filter(b => isNearExpiry(b.tanggal_kadaluarsa)).length, 0);
    return [
      { label: 'Total Reagen', value: totalReagen, icon: <ScienceIcon sx={{ fontSize: 22 }} />, color: '#8b5cf6', maxValue: totalReagen || 100, onClick: () => { setTab(0); setExpiryFilter(''); } },
      { label: 'Stok Gudang (Botol)', value: totalBotol, icon: <InventoryIcon sx={{ fontSize: 22 }} />, color: '#10b981', maxValue: totalBotol || 1000, onClick: () => { setTab(1); setExpiryFilter(''); } },
      { label: 'Kadaluarsa', value: expiredCount, icon: <EventBusyIcon sx={{ fontSize: 22 }} />, color: '#ef4444', maxValue: expiredCount || 10, onClick: () => { setTab(1); setExpiryFilter(prev => prev === 'expired' ? '' : 'expired'); } },
      { label: 'Hampir Kadaluarsa', value: nearExp, icon: <EventBusyIcon sx={{ fontSize: 22 }} />, color: '#f59e0b', maxValue: nearExp || 10, onClick: () => { setTab(1); setExpiryFilter(prev => prev === 'near' ? '' : 'near'); } },
    ];
  };

  // Daftar stok gudang yang difilter berdasarkan status kadaluarsa (dari klik kartu statistik)
  const filteredStok = expiryFilter
    ? stokGudang
        .map(g => ({
          ...g,
          batches: g.batches.filter(b => expiryFilter === 'expired' ? isExpired(b.tanggal_kadaluarsa) : isNearExpiry(b.tanggal_kadaluarsa)),
        }))
        .filter(g => g.batches.length > 0)
    : stokGudang;

  // Pagination client-side untuk Stok Gudang, Barang Masuk, Permohonan, & Riwayat Pemakaian
  const stokPg = useClientPagination(filteredStok);
  const masukPg = useClientPagination(masukList);
  const pengeluaranPg = useClientPagination(pengeluaranList);
  const pemakaianPg = useClientPagination(pemakaianList);

  const TabButton = ({ idx, label }) => (
    <button
      onClick={() => { setTab(idx); setExpiryFilter(''); }}
      style={{
        padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
        fontSize: '0.82rem', transition: 'all 0.2s',
        background: tab === idx ? '#8b5cf6' : 'transparent',
        color: tab === idx ? '#fff' : '#64748b',
        boxShadow: tab === idx ? '0 2px 8px rgba(139,92,246,0.3)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  const SubTabButton = ({ idx, label }) => (
    <button
      onClick={() => setLabSubTab(idx)}
      style={{
        padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
        fontSize: '0.78rem', transition: 'all 0.2s',
        background: labSubTab === idx ? '#10b981' : 'transparent',
        color: labSubTab === idx ? '#fff' : '#64748b',
        boxShadow: labSubTab === idx ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  const thSx = { fontWeight: 600, fontSize: '0.8rem', color: '#64748b' };

  const ExpiryChip = ({ date }) => {
    if (!date) return <Chip label="Belum diisi" size="small" variant="outlined" />;
    const label = formatDateForDisplay(date);
    if (isExpired(date)) return <Chip label={`${label} · Expired`} size="small" color="error" sx={{ fontWeight: 600 }} />;
    if (isNearExpiry(date)) return <Chip label={`${label} · Segera`} size="small" color="warning" sx={{ fontWeight: 600 }} />;
    return <Chip label={label} size="small" color="success" variant="outlined" />;
  };

  if (!session) {
    return <Box p={3}><Alert severity="warning">Silakan login</Alert></Box>;
  }

  return (
    <PolishedPageShell
      title={pageTitle || 'Persediaan Reagen'}
      subtitle={pageSubtitle || 'Kelola reagen laboratorium: stok gudang (botol), kadaluarsa, pengeluaran ke LAB, dan pemakaian per gram'}
      statistics={getStatCards()}
      actions={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAll} disabled={loading}
            sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.08)' } }}>
            Refresh
          </Button>
          {tab === 0 && canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateModal}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Tambah Reagen
            </Button>
          )}
          {tab === 2 && isPicGudang && (
            <Button variant="contained" startIcon={<UploadIcon />} onClick={openMasukModal}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Tambah Stok Reagen
            </Button>
          )}
          {tab === 3 && isPicLab && (
            <Button variant="contained" startIcon={<SendIcon />} onClick={() => setPengeluaranOpen(true)}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Ajukan Permohonan
            </Button>
          )}
          {tab === 5 && (isPicGudang || isKabagTu) && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openOpnameModal}
              sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              Stok Opname
            </Button>
          )}
        </Box>
      }
    >
      {/* TABS */}
      <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {tabs.map((t, i) => canSeeTab(i) ? <TabButton key={i} idx={i} label={t} /> : null)}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* FILTER BAR (shared) */}
      {(tab === 0 || tab === 1 || tab === 4) && (
        <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Cari nama / kode reagen..."
            value={filters.search || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            sx={{ minWidth: 240 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SendIcon sx={{ transform: 'rotate(-45deg)' }} fontSize="small" /></InputAdornment> }}
          />
          <TextField
            select size="small" label="Kategori" value={filters.kategori || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, kategori: e.target.value }))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Semua Kategori</MenuItem>
            {KATEGORI_OPTIONS.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <Button variant="contained" size="small" onClick={() => setPagination(prev => ({ ...prev, currentPage: 1 }))}>
            Terapkan
          </Button>
          {(filters.search || filters.kategori) && (
            <Button size="small" color="error" onClick={() => setFilters({ search: '', kategori: '' })}>Reset</Button>
          )}
          {tab === 1 && isPicGudang && (
            <>
              <Button size="small" variant="text" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate}
                sx={{ textTransform: 'none', fontSize: '0.75rem', ml: 'auto' }}>
                Download Template
              </Button>
              <Button size="small" variant="text" startIcon={<CloudUploadIcon />} onClick={() => setImportStokOpen(true)}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                Import Stok
              </Button>
            </>
          )}
        </Paper>
      )}

      {/* ==================== TAB 0: MASTER REAGEN ==================== */}
      {tab === 0 && (
        <Fade in>
          <Box>
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                  <TableCell>Kode</TableCell>
                  <TableCell>Kategori</TableCell>
                  <TableCell>Nama Barang / Uraian</TableCell>
                  <TableCell>Berat / Volume</TableCell>
                  <TableCell>Kemasan</TableCell>
                  <TableCell>Kode Lama</TableCell>
                  <TableCell align="right">Stok (Botol)</TableCell>
                  {canManage && <TableCell align="center">Aksi</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {reagenList.map((r) => (
                  <TableRow key={r.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{r.kode_barang || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">#{r.no_urut || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.kategori} size="small" color={kategoriColors[r.kategori] || 'default'} sx={{ fontWeight: 500 }} />
                    </TableCell>
                    <TableCell><Typography fontWeight={500}>{r.nama_barang}</Typography></TableCell>
                    <TableCell>{r.berat_volume || '-'}</TableCell>
                    <TableCell>{r.satuan_kemasan || '-'}</TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{r.kode_lama || '-'}</Typography></TableCell>
                    <TableCell align="right">
                      <Chip label={r.saldo_botol || 0} size="small" color={(r.saldo_botol || 0) > 0 ? 'success' : 'error'} sx={{ fontWeight: 600, minWidth: 50 }} />
                    </TableCell>
                    {canManage && (
                      <TableCell align="center">
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditModal(r)} sx={{ color: '#8b5cf6' }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Hapus"><IconButton size="small" onClick={() => handleDeleteReagen(r.id)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {reagenList.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada data reagen</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={pagination.total}
            page={pagination.currentPage - 1}
            onPageChange={handleMasterChangePage}
            rowsPerPage={pagination.perPage}
            onRowsPerPageChange={handleMasterChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="Baris per halaman"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 1: STOK GUDANG (per batch / expiry) ==================== */}
      {tab === 1 && (
        <Fade in>
          <Box>
            {expiryFilter && (
              <Alert
                severity={expiryFilter === 'expired' ? 'error' : 'warning'}
                sx={{ mb: 1.5 }}
                action={<Button size="small" onClick={() => setExpiryFilter('')}>Reset Filter</Button>}
              >
                Menampilkan batch {expiryFilter === 'expired' ? 'yang sudah KADALUARSA (expired)' : 'yang HAMPIR KADALUARSA (≤ 90 hari)'}.
              </Alert>
            )}
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                    <TableCell width={40}></TableCell>
                    <TableCell>Kode</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Nama Barang / Uraian</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Tgl Kadaluarsa</TableCell>
                    <TableCell align="right">Stok Batch (Botol)</TableCell>
                    <TableCell align="right">Total (Botol)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stokPg.paged.map((g) => {
                    const isExp = expandedPengeluaran[`stok-${g.id}`];
                    const totalLabel = expiryFilter ? g.batches.reduce((s, b) => s + (Number(b.stok_botol) || 0), 0) : g.saldo_botol;
                    return (
                      <React.Fragment key={g.id}>
                        <TableRow hover sx={{ '&:last-child td': { border: 0 }, bgcolor: isExp ? '#f5f3ff' : 'inherit', cursor: 'pointer' }}
                          onClick={() => setExpandedPengeluaran(prev => ({ ...prev, [`stok-${g.id}`]: !prev[`stok-${g.id}`] }))}>
                          <TableCell>{isExp ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}</TableCell>
                          <TableCell><Typography variant="body2" fontWeight={600}>{g.kode_barang || '-'}</Typography></TableCell>
                          <TableCell>
                            <Chip label={g.kategori} size="small" color={kategoriColors[g.kategori] || 'default'} />
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight={500}>{g.nama_barang}</Typography>
                            <Typography variant="caption" color="text.secondary">{g.berat_volume} · {g.satuan_kemasan}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{g.batches.length} batch</Typography>
                            {g.batches.some(b => isExpired(b.tanggal_kadaluarsa)) && (
                              <Typography variant="caption" color="error">⚠ Ada batch expired</Typography>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell align="right">
                            <Chip label={totalLabel} size="small" color={(totalLabel || 0) > 0 ? 'success' : 'error'} sx={{ fontWeight: 600, minWidth: 50 }} />
                          </TableCell>
                        </TableRow>
                        {isExp && g.batches.map((b) => (
                          <TableRow key={b.batch_id} sx={{ bgcolor: '#fafafc' }}>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell sx={{ pl: 6 }}><Typography variant="caption" color="text.secondary">Batch:</Typography></TableCell>
                            <TableCell><Typography variant="body2" fontWeight={500}>{b.no_batch || '-'}</Typography></TableCell>
                            <TableCell><ExpiryChip date={b.tanggal_kadaluarsa} /></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>{b.stok_botol} botol</Typography></TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {filteredStok.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                      {expiryFilter ? 'Tidak ada batch dengan status filter ini.' : 'Belum ada stok gudang. Tambahkan barang masuk terlebih dahulu.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={stokPg.total}
              page={stokPg.page}
              onPageChange={stokPg.onChangePage}
              rowsPerPage={stokPg.perPage}
              onRowsPerPageChange={stokPg.onChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage="Baris per halaman"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 2: BARANG MASUK ==================== */}
      {tab === 2 && (
        <Fade in>
          <Box>
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                  <TableCell>Tanggal</TableCell>
                  <TableCell>Reagen</TableCell>
                  <TableCell>Kategori</TableCell>
                  <TableCell>No. Batch</TableCell>
                  <TableCell>Tgl Kadaluarsa</TableCell>
                  <TableCell align="right">Jumlah (Botol)</TableCell>
                  <TableCell>Penginput</TableCell>
                  {isAdminPemeliharaan && <TableCell align="center">Aksi</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {masukPg.paged.map((m) => (
                  <TableRow key={m.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>{formatDateForDisplay(m.tanggal_pembelian || m.created_at)}</TableCell>
                    <TableCell>
                      <Typography fontWeight={500}>{m.nama_barang}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.berat_volume} · {m.satuan_kemasan}</Typography>
                    </TableCell>
                    <TableCell><Chip label={m.kategori} size="small" color={kategoriColors[m.kategori] || 'default'} /></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={600}>{m.no_batch || '-'}</Typography></TableCell>
                    <TableCell><ExpiryChip date={m.tanggal_kadaluarsa} /></TableCell>
                    <TableCell align="right"><Typography variant="body2" fontWeight={600}>{m.jumlah_botol} botol</Typography></TableCell>
                    <TableCell>{m.created_by}</TableCell>
                    {isAdminPemeliharaan && (
                      <TableCell align="center">
                        <Tooltip title="Hapus"><IconButton size="small" onClick={() => handleDeleteMasuk(m.id)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {masukList.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={isAdminPemeliharaan ? 8 : 7} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada barang masuk</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={masukPg.total}
            page={masukPg.page}
            onPageChange={masukPg.onChangePage}
            rowsPerPage={masukPg.perPage}
            onRowsPerPageChange={masukPg.onChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="Baris per halaman"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 3: PENGELUARAN KE LAB ==================== */}
      {tab === 3 && (
        <Fade in>
          <Box>
            {(() => {
              const needsKatim = pengeluaranList.filter(g => g.status === 'menunggu_katim' || g.status === 'diajukan');
              const needsGudang = pengeluaranList.filter(g => g.status === 'disetujui_katim');
              const needsKabag = pengeluaranList.filter(g => g.status === 'diserahkan' || g.status === 'diserahkan_sebagian');
              const alerts = [];
              if (isKatim && needsKatim.length > 0)
                alerts.push({ severity: 'warning', msg: `🔔 ${needsKatim.length} pengeluaran reagen menunggu persetujuan Anda (Katim)` });
              if (isPicGudang && needsGudang.length > 0)
                alerts.push({ severity: 'success', msg: `🔔 ${needsGudang.length} pengeluaran reagen disetujui Katim, siap diverifikasi & diserahkan ke Lab (PIC Gudang)` });
              if (isKabagTu && needsKabag.length > 0)
                alerts.push({ severity: 'info', msg: `🔔 ${needsKabag.length} pengeluaran reagen telah diserahkan, menunggu persetujuan akhir Anda (Kabag TU)` });
              return alerts.map((a, i) => (
                <Alert key={i} severity={a.severity} sx={{ mb: 1.5 }}>{a.msg}</Alert>
              ));
            })()}
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                    <TableCell width={40}></TableCell>
                    <TableCell>Pengaju</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell>Lab Tujuan</TableCell>
                    <TableCell>Catatan</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Aksi</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pengeluaranPg.paged.map((group) => {
                    const isExp = expandedPengeluaran[group.group_id];
                    return (
                      <React.Fragment key={group.group_id}>
                        <TableRow hover sx={{ '&:last-child td': { border: 0 }, bgcolor: isExp ? '#f5f3ff' : 'inherit', cursor: 'pointer' }}
                          onClick={() => setExpandedPengeluaran(prev => ({ ...prev, [group.group_id]: !prev[group.group_id] }))}>
                          <TableCell>
                            {isExp ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                          </TableCell>
                          <TableCell><Typography variant="body2" fontWeight={500}>{group.requested_by || '-'}</Typography></TableCell>
                          <TableCell>
                            <Typography variant="body2">{group.items.length} reagen</Typography>
                            <Typography variant="caption" color="text.secondary">{group.items.map(i => i.nama_barang).join(', ')}</Typography>
                          </TableCell>
                          <TableCell>
                            {[...new Set(group.items.map(i => i.lab_tujuan).filter(Boolean))].map(l => (
                              <Chip key={l} label={getLabLabel(l)} size="small" color={LAB_COLORS[l] || 'default'} sx={{ mr: 0.5, mb: 0.3 }} />
                            ))}
                          </TableCell>
                          <TableCell><Typography variant="body2" color="text.secondary" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.catatan || '-'}</Typography></TableCell>
                          <TableCell>
                            <Chip label={statusLabels[group.status] || group.status || 'Draft'} size="small" color={statusColors[group.status] || 'default'} sx={{ fontWeight: 500 }} />
                          </TableCell>
                          <TableCell align="center" onClick={e => e.stopPropagation()}>
                            {group.status === 'draft' && isPicLab && (
                              <>
                                <Tooltip title="Kirim ke Katim">
                                  <IconButton size="small" onClick={() => setKatimModal({ open: true, groupId: group.group_id, itemCount: group.items.length })}
                                    sx={{ color: '#3b82f6' }}><SendIcon fontSize="small" /></IconButton>
                                </Tooltip>
                                <Tooltip title="Hapus">
                                  <IconButton size="small" onClick={() => handleDeletePengeluaran(group.group_id)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton>
                                </Tooltip>
                              </>
                            )}
                            {(group.status === 'diajukan' || group.status === 'menunggu_katim') && isKatim && (
                              <>
                                <Tooltip title="Setujui"><IconButton size="small" onClick={async () => { const r = await api.approveKatim(session, group.group_id); if (r.success) { showSnackbar(r.message); fetchAll(); } }} sx={{ color: '#10b981' }}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Tolak"><IconButton size="small" onClick={() => handleTolakPengeluaran(group.group_id)} sx={{ color: '#ef4444' }}><CancelIcon fontSize="small" /></IconButton></Tooltip>
                              </>
                            )}
                            {group.status === 'disetujui_katim' && isPicGudang && (
                              <>
                                <Tooltip title="Verifikasi & Serahkan ke Lab"><IconButton size="small" onClick={() => handleSerahkan(group.group_id)} sx={{ color: '#10b981' }}><LocalShippingIcon fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Tolak"><IconButton size="small" onClick={() => handleTolakPengeluaran(group.group_id, 'Stok tidak mencukupi')} sx={{ color: '#ef4444' }}><CancelIcon fontSize="small" /></IconButton></Tooltip>
                              </>
                            )}
                            {group.status === 'diserahkan' && isKabagTu && (
                              <>
                                <Tooltip title="Setujui"><IconButton size="small" onClick={async () => { const r = await api.approveKabag(session, group.group_id); if (r.success) { showSnackbar(r.message); fetchAll(); } }} sx={{ color: '#10b981' }}><CheckCircleIcon fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title="Tolak"><IconButton size="small" onClick={() => handleTolakPengeluaran(group.group_id)} sx={{ color: '#ef4444' }}><CancelIcon fontSize="small" /></IconButton></Tooltip>
                              </>
                            )}
                            {group.status === 'disetujui_kabag' && (
                              <Tooltip title="Cetak SPB & SBBK">
                                <IconButton size="small" onClick={() => cetakSPBSBBK({ group, tipe: 'reagen' })}
                                  sx={{ color: '#8b5cf6' }}><PrintIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            )}
                            {/* Status info */}
                            {group.status === 'menunggu_katim' && group.katim_nama && <Typography variant="caption" display="block" color="text.secondary">✉️ Dikirim ke: {group.katim_nama}</Typography>}
                            {group.status === 'disetujui_katim' && group.approved_katim_by && <Typography variant="caption" display="block" color="success.main">✅ Disetujui Katim: {group.approved_katim_by}</Typography>}
                            {group.status === 'disetujui_katim' && <Typography variant="caption" display="block" color="text.secondary">➡️ Diteruskan ke PIC Gudang untuk verifikasi & penyerahan</Typography>}
                            {group.status === 'diserahkan' && group.delivered_by && <Typography variant="caption" display="block" color="success.main">✅ Diserahkan oleh: {group.delivered_by} · {formatDateForDisplay(group.delivered_at)}</Typography>}
                            {group.status === 'diserahkan' && <Typography variant="caption" display="block" color="text.secondary">➡️ Menunggu persetujuan akhir Kabag TU</Typography>}
                            {group.status === 'disetujui_kabag' && group.approved_kabag_by && <Typography variant="caption" display="block" color="success.main">✅ Disetujui Kabag: {group.approved_kabag_by} · Selesai</Typography>}
                          </TableCell>
                        </TableRow>
                        {isExp && group.items.map((i) => (
                          <TableRow key={i.id} sx={{ bgcolor: '#fafafc' }}>
                            <TableCell></TableCell>
                            <TableCell sx={{ pl: 6 }}><Typography variant="caption" color="text.secondary">Item:</Typography></TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>{i.nama_barang}</Typography>
                              <Typography variant="caption" color="text.secondary">{i.berat_volume} · {i.satuan}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={getLabLabel(i.lab_tujuan)} size="small" color={LAB_COLORS[i.lab_tujuan] || 'default'} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">Batch: {i.no_batch || '-'}</Typography>
                            </TableCell>
                            <TableCell><Typography variant="body2" fontWeight={600}>{i.jumlah_botol} botol</Typography></TableCell>
                            <TableCell><Chip label={statusLabels[i.status] || i.status} size="small" color={statusColors[i.status] || 'default'} /></TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {pengeluaranList.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada pengeluaran ke Lab</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={pengeluaranPg.total}
              page={pengeluaranPg.page}
              onPageChange={pengeluaranPg.onChangePage}
              rowsPerPage={pengeluaranPg.perPage}
              onRowsPerPageChange={pengeluaranPg.onChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage="Baris per halaman"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 4: PERSEDIAAN & PEMAKAIAN LAB ==================== */}
      {tab === 4 && (
        <Fade in>
          <Box>
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <SubTabButton idx={0} label="Persediaan Lab" />
              <SubTabButton idx={1} label="Riwayat Pemakaian" />
            </Box>
            {labSubTab === 0 && (
            <Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <TextField select size="small" label="Filter Lab Tujuan" value={filters.lab}
                onChange={(e) => setFilters(prev => ({ ...prev, lab: e.target.value }))} sx={{ minWidth: 180 }}>
                <MenuItem value="">Semua Lab</MenuItem>
                {LAB_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
              {filters.lab && (
                <Typography variant="caption" color="text.secondary">Menampilkan persediaan {getLabLabel(filters.lab)}</Typography>
              )}
            </Box>
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                    <TableCell>Kode</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Nama Barang</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Tgl Kadaluarsa</TableCell>
                    <TableCell align="right">Berat Awal</TableCell>
                    <TableCell align="right">Sisa</TableCell>
                    <TableCell>Tgl Masuk Lab</TableCell>
                    <TableCell>Lab</TableCell>
                    {isPicLab && <TableCell align="center">Aksi</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {labPaged.map((l) => (
                    <TableRow key={l.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell><Typography variant="body2" fontWeight={600}>{l.kode_barang || '-'}</Typography></TableCell>
                      <TableCell><Chip label={l.kategori} size="small" color={kategoriColors[l.kategori] || 'default'} /></TableCell>
                      <TableCell><Typography fontWeight={500}>{l.nama_barang}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{l.no_batch || '-'}</Typography></TableCell>
                      <TableCell><ExpiryChip date={l.tanggal_kadaluarsa} /></TableCell>
                      <TableCell align="right"><Typography variant="body2">{Number(l.berat_awal)} {l.satuan_lab}</Typography></TableCell>
                      <TableCell align="right">
                        <Chip label={`${Number(l.sisa_berat)} ${l.satuan_lab}`} size="small"
                          color={Number(l.sisa_berat) <= 0 ? 'error' : 'success'} sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>{formatDateForDisplay(l.tanggal_masuk_lab)}</TableCell>
                      <TableCell><Chip label={getLabLabel(l.lab_tujuan)} size="small" color={LAB_COLORS[l.lab_tujuan] || 'default'} /></TableCell>
                      {isPicLab && (
                        <TableCell align="center">
                          <Tooltip title="Catat Pemakaian">
                            <IconButton size="small" onClick={() => openPemakaian(l)} sx={{ color: '#8b5cf6' }} disabled={Number(l.sisa_berat) <= 0}>
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {labStok.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada persediaan di LAB</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={labStok.length}
              page={labPagination.page}
              onPageChange={handleLabChangePage}
              rowsPerPage={labPagination.perPage}
              onRowsPerPageChange={handleLabChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage="Baris per halaman"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
            </Box>
            )}

            {labSubTab === 1 && (
            <Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <TextField select size="small" label="Filter Lab Tujuan" value={filters.lab}
                onChange={(e) => setFilters(prev => ({ ...prev, lab: e.target.value }))} sx={{ minWidth: 180 }}>
                <MenuItem value="">Semua Lab</MenuItem>
                {LAB_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
              {filters.lab && (
                <Typography variant="caption" color="text.secondary">Menampilkan pemakaian {getLabLabel(filters.lab)}</Typography>
              )}
            </Box>
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                    <TableCell>Tanggal</TableCell>
                    <TableCell>Reagen</TableCell>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Lab</TableCell>
                    <TableCell align="right">Jumlah</TableCell>
                    <TableCell>Catatan</TableCell>
                    <TableCell>Oleh</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pemakaianPg.paged.map((p) => (
                    <TableRow key={p.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell>{formatDateForDisplay(p.tanggal)}</TableCell>
                      <TableCell><Typography fontWeight={500}>{p.nama_barang || '-'}</Typography></TableCell>
                      <TableCell><Chip label={p.kategori || '-'} size="small" color={kategoriColors[p.kategori] || 'default'} /></TableCell>
                      <TableCell><Typography variant="body2">{p.no_batch || '-'}</Typography></TableCell>
                      <TableCell><Chip label={getLabLabel(p.lab_tujuan)} size="small" color={LAB_COLORS[p.lab_tujuan] || 'default'} /></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={600}>{Number(p.jumlah)} {p.satuan_lab || 'g'}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{p.catatan || '-'}</Typography></TableCell>
                      <TableCell>{p.created_by}</TableCell>
                    </TableRow>
                  ))}
                  {pemakaianList.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#94a3b8' }}>Belum ada pemakaian lab</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={pemakaianPg.total}
              page={pemakaianPg.page}
              onPageChange={pemakaianPg.onChangePage}
              rowsPerPage={pemakaianPg.perPage}
              onRowsPerPageChange={pemakaianPg.onChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage="Baris per halaman"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
            </Box>
            )}
          </Box>
        </Fade>
      )}

      {/* ==================== TAB 5: STOK OPNAME ==================== */}
      {tab === 5 && (
        <Fade in>
          <Box>
            {/* Filter & Search */}
            <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                <TextField size="small" label="Cari reagen..." value={filters.search}
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
              </Box>
            </Paper>

            {/* All Reagen with Stok & Mutasi */}
            <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
              Mutasi Stok Reagen
              {mutasiDateRange.mulai && <Chip size="small" label={`Periode: ${mutasiDateRange.mulai} s/d ${mutasiDateRange.akhir || 'sekarang'}`} sx={{ ml: 1 }} />}
            </Typography>
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', mb: 4 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                    <TableCell>Reagen</TableCell>
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
                        <Typography variant="caption" color="text.secondary">{b.kode_barang} {b.kategori && `· ${b.kategori}`}</Typography>
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
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94a3b8' }}>Tidak ada data reagen</TableCell></TableRow>
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
                  <TableRow sx={{ bgcolor: '#f8fafc', '& th': thSx }}>
                    <TableCell>Tanggal</TableCell>
                    <TableCell>Reagen</TableCell>
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
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{o.nama_barang}</Typography>
                        <Typography variant="caption" color="text.secondary">{o.kode_barang}</Typography>
                      </TableCell>
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

      {/* ==================== DIALOGS & MODALS ==================== */}

      {/* Master CRUD modal */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>{modalMode === 'create' ? 'Tambah Reagen' : 'Edit Reagen'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Kode Barang" value={formData.kode_barang} onChange={(e) => setFormData({ ...formData, kode_barang: e.target.value })} placeholder="1010102001" size="small" />
            <TextField label="No. Urut" value={formData.no_urut} onChange={(e) => setFormData({ ...formData, no_urut: e.target.value })} placeholder="000002" size="small" />
            <TextField select label="Kategori" value={formData.kategori} onChange={(e) => setFormData({ ...formData, kategori: e.target.value })} size="small">
              {KATEGORI_OPTIONS.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
            </TextField>
            <TextField label="Berat / Volume" value={formData.berat_volume} onChange={(e) => setFormData({ ...formData, berat_volume: e.target.value })} placeholder="1000 g / 2500 mL" size="small" />
            <TextField label="Satuan Kemasan" value={formData.satuan_kemasan} onChange={(e) => setFormData({ ...formData, satuan_kemasan: e.target.value })} size="small" />
            <TextField label="Satuan Gudang" value={formData.satuan} onChange={(e) => setFormData({ ...formData, satuan: e.target.value })} size="small" />
            <TextField label="Kode Lama" value={formData.kode_lama} onChange={(e) => setFormData({ ...formData, kode_lama: e.target.value })} placeholder="A-2053-1KG - L9" size="small" />
            <TextField label="Nama Barang / Uraian" value={formData.nama_barang} onChange={(e) => setFormData({ ...formData, nama_barang: e.target.value })} size="small" sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' } }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitReagen}>Simpan</Button>
        </DialogActions>
      </Dialog>

      {/* Barang Masuk modal — Upload Nota + Input Stok Reagen */}
      <Dialog open={masukOpen} onClose={() => setMasukOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <UploadIcon color="primary" />
            Tambah Stok Reagen — Upload Nota & Input Barang
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Upload Nota */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed', borderColor: '#cbd5e1' }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>1. Upload Nota / Kuitansi</Typography>
              <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                <Button variant="contained" component="label" disabled={masukUploading}>
                  {masukUploading ? 'Mengupload...' : 'Pilih File'}
                  <input type="file" hidden accept="image/*,.pdf" onChange={(e) => { if (e.target.files[0]) handleMasukFileUpload(e.target.files[0]); e.target.value = ''; }} />
                </Button>
                {masukUploading && <CircularProgress size={20} />}
                {masukForm.kuitansi_url && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip icon={<CheckCircleIcon />} label="Nota terupload" color="success" size="small" />
                    <a href={masukForm.kuitansi_url} target="_blank" rel="noreferrer">
                      <Button size="small" startIcon={<DownloadIcon />}>Lihat</Button>
                    </a>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Detail Stok */}
            <Typography variant="subtitle2" fontWeight={600}>2. Detail Stok Reagen</Typography>
            <Autocomplete
              size="small"
              options={allReagen}
              getOptionLabel={(r) => `${r.kode_barang || ''} · ${r.nama_barang} (${r.berat_volume || '-'})`}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
              value={allReagen.find(r => String(r.id) === String(masukForm.reagen_id)) || null}
              onChange={(e, newVal) => setMasukForm({ ...masukForm, reagen_id: newVal ? newVal.id : '' })}
              noOptionsText="Tidak ada reagen"
              renderInput={(params) => (
                <TextField {...params} label="Pilih Reagen" placeholder="Ketik nama / kode reagen..." size="small" />
              )}
            />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="No. Batch" value={masukForm.no_batch} onChange={(e) => setMasukForm({ ...masukForm, no_batch: e.target.value })} placeholder="Kosong = otomatis" size="small" />
              <TextField label="Tanggal Kadaluarsa" type="date" value={masukForm.tanggal_kadaluarsa} onChange={(e) => setMasukForm({ ...masukForm, tanggal_kadaluarsa: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
              <TextField label="Jumlah (Botol)" type="number" value={masukForm.jumlah_botol} onChange={(e) => setMasukForm({ ...masukForm, jumlah_botol: e.target.value })} size="small" />
              <TextField label="Tanggal Pembelian" type="date" value={masukForm.tanggal_pembelian} onChange={(e) => setMasukForm({ ...masukForm, tanggal_pembelian: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Box>
            <TextField label="Catatan" value={masukForm.catatan} onChange={(e) => setMasukForm({ ...masukForm, catatan: e.target.value })} size="small" multiline rows={2} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMasukOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitMasuk} disabled={!masukForm.kuitansi_url || !masukForm.reagen_id || !masukForm.jumlah_botol}>
            Simpan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pengeluaran ke Lab modal */}
      <Dialog open={pengeluaranOpen} onClose={() => setPengeluaranOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Pengeluaran Reagen ke Lab</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {pengeluaranItems.map((item, idx) => {
              const batches = allReagen.find(r => String(r.id) === String(item.reagen_id))
                ? stokGudang.find(g => String(g.id) === String(item.reagen_id))?.batches || []
                : [];
              return (
                <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField select size="small" label="Reagen" sx={{ minWidth: 260, flex: 1 }}
                    value={item.reagen_id}
                    onChange={(e) => updatePengeluaranItem(idx, 'reagen_id', e.target.value)}>
                    <MenuItem value="">— Pilih —</MenuItem>
                    {allReagen.filter(r => (r.saldo_botol || 0) > 0).map(r => (
                      <MenuItem key={r.id} value={r.id}>{`${r.nama_barang} (stok ${r.saldo_botol} botol)`}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Batch (expiry)" sx={{ minWidth: 200 }}
                    value={item.batch_id}
                    onChange={(e) => updatePengeluaranItem(idx, 'batch_id', e.target.value)}>
                    <MenuItem value="">Tanpa batch</MenuItem>
                    {batches.filter(b => b.stok_botol > 0).map(b => (
                      <MenuItem key={b.batch_id} value={b.batch_id}>
                        {`${b.no_batch || '-'} · ${formatDateForDisplay(b.tanggal_kadaluarsa)} (${b.stok_botol})`}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Lab Tujuan" sx={{ minWidth: 140 }}
                    value={item.lab_tujuan || 'pangan'}
                    onChange={(e) => updatePengeluaranItem(idx, 'lab_tujuan', e.target.value)}>
                    {LAB_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="Jumlah (Botol)" type="number" sx={{ width: 120 }}
                    value={item.jumlah_botol}
                    onChange={(e) => updatePengeluaranItem(idx, 'jumlah_botol', e.target.value)} />
                  <IconButton size="small" onClick={() => removePengeluaranItem(idx)} sx={{ color: '#ef4444' }} disabled={pengeluaranItems.length <= 1}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
            <Button startIcon={<AddIcon />} onClick={addPengeluaranItem} size="small">Tambah Item</Button>
            <TextField label="Catatan" value={pengeluaranCatatan} onChange={(e) => setPengeluaranCatatan(e.target.value)} size="small" multiline rows={2} />
            <Alert severity="info">Alur: Draft → disetujui Katim → disetujui Kabag TU → diserahkan PIC Gudang. Setelah diserahkan, stok gudang (botol) berkurang dan otomatis masuk persediaan LAB dalam gram/mL sesuai berat kemasan.</Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPengeluaranOpen(false)}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitPengeluaran}>Simpan Draft</Button>
        </DialogActions>
      </Dialog>

      {/* Pemakaian Lab modal */}
      <Dialog open={pemakaianModal.open} onClose={() => setPemakaianModal({ open: false, labStokItem: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Catat Pemakaian Lab</DialogTitle>
        <DialogContent dividers>
          {pemakaianModal.labStokItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info">
                {pemakaianModal.labStokItem.nama_barang} — Sisa: <strong>{Number(pemakaianModal.labStokItem.sisa_berat)} {pemakaianModal.labStokItem.satuan_lab}</strong>
              </Alert>
              <TextField label={`Jumlah (${pemakaianModal.labStokItem.satuan_lab || 'g'})`} type="number" value={pemakaianForm.jumlah}
                onChange={(e) => setPemakaianForm({ ...pemakaianForm, jumlah: e.target.value })} size="small" />
              <TextField label="Tanggal" type="date" value={pemakaianForm.tanggal}
                onChange={(e) => setPemakaianForm({ ...pemakaianForm, tanggal: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
              <TextField label="Catatan / Uraian Pemakaian" value={pemakaianForm.catatan}
                onChange={(e) => setPemakaianForm({ ...pemakaianForm, catatan: e.target.value })} size="small" multiline rows={2} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPemakaianModal({ open: false, labStokItem: null })}>Batal</Button>
          <Button variant="contained" onClick={handleSubmitPemakaian}>Simpan</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Stok Opname */}
      <Dialog open={opnameModalOpen} onClose={() => setOpnameModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Stok Opname</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              size="small"
              options={allReagen}
              getOptionLabel={(r) => `${r.nama_barang} (stok sistem: ${r.saldo_botol || 0} botol)`}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
              value={allReagen.find(r => String(r.id) === String(opnameForm.reagen_id)) || null}
              onChange={(e, newVal) => setOpnameForm(prev => ({ ...prev, reagen_id: newVal ? newVal.id : '' }))}
              noOptionsText="Tidak ada reagen"
              renderInput={(params) => (
                <TextField {...params} label="Pilih Reagen" placeholder="Ketik nama / kode reagen..." required size="small" />
              )}
            />
            <TextField label="Stok Nyata (hasil hitung fisik, botol)" type="number" fullWidth required value={opnameForm.stok_nyata}
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

      {/* Modal History Mutasi */}
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
                    <TableCell>Batch</TableCell>
                    <TableCell align="right">Jumlah</TableCell>
                    <TableCell>Keterangan</TableCell>
                    <TableCell>Oleh</TableCell>
                    {historyModal.jenis === 'masuk' && <TableCell>Nota</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyModal.data.map((item, idx) => (
                    <TableRow key={item.id || idx} hover>
                      <TableCell>{(item.tanggal || item.tanggal_pembelian || '').split('T')[0]}</TableCell>
                      <TableCell><Typography variant="body2">{item.no_batch || '-'}</Typography></TableCell>
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

      {/* Modal Kirim ke Katim */}
      <KirimKeKatimModal
        open={katimModal.open}
        onClose={() => setKatimModal({ ...katimModal, open: false })}
        groupId={katimModal.groupId}
        itemCount={katimModal.itemCount}
        session={session}
        onSuccess={(msg) => { showSnackbar(msg); fetchAll(); }}
      />

      {/* Modal Import Stok Gudang */}
      <ImportStokModal
        open={importStokOpen}
        onClose={() => setImportStokOpen(false)}
        session={session}
        onSuccess={handleImportStokSuccess}
      />

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        message={confirmDialog.message}
        loading={confirmDialog.loading}
        onClose={() => setConfirmDialog({ open: false, message: '', onConfirm: null })}
        onConfirm={confirmDialog.onConfirm}
      />

      {/* Reject dialog */}
      <RejectDialog
        open={rejectDialog.open}
        groupId={rejectDialog.groupId}
        onClose={() => setRejectDialog({ open: false, groupId: null, onConfirm: null })}
        onConfirm={rejectDialog.onConfirm}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PolishedPageShell>
  );
};

export default ReagenContainer;
