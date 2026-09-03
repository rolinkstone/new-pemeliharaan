// components/pencatatan/modals/PencatatanFormModal.js
// Form catat barang sementara (diterima belum diinput keuangan / diambil user)

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, MenuItem, CircularProgress,
} from '@mui/material';

const today = () => new Date().toISOString().split('T')[0];

export default function PencatatanFormModal({ open, onClose, onSubmit, tipe, initialData, loading }) {
  const isDiterima = tipe === 'diterima';
  const [form, setForm] = useState({
    nama_barang: '', jenis: '', kategori: '', jumlah: 1, satuan: 'pcs',
    tanggal: today(), sumber: '', penerima: '', catatan: '',
  });

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        nama_barang: initialData.nama_barang || '',
        jenis: initialData.jenis || '',
        kategori: initialData.kategori || '',
        jumlah: initialData.jumlah ?? 1,
        satuan: initialData.satuan || 'pcs',
        tanggal: initialData.tanggal ? String(initialData.tanggal).slice(0, 10) : today(),
        sumber: initialData.sumber || '',
        penerima: initialData.penerima || '',
        catatan: initialData.catatan || '',
      });
    } else {
      setForm({
        nama_barang: '', jenis: '', kategori: '', jumlah: 1, satuan: 'pcs',
        tanggal: today(), sumber: '', penerima: '', catatan: '',
      });
    }
  }, [open, initialData]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.nama_barang.trim()) return;
    onSubmit({
      tipe,
      nama_barang: form.nama_barang.trim(),
      jenis: form.jenis.trim() || null,
      kategori: form.kategori.trim() || null,
      jumlah: form.jumlah,
      satuan: form.satuan.trim() || 'pcs',
      tanggal: form.tanggal || null,
      sumber: form.sumber.trim() || null,
      penerima: form.penerima.trim() || null,
      catatan: form.catatan.trim() || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        {initialData ? 'Edit Pencatatan' : isDiterima ? 'Catat Barang Diterima' : 'Catat Barang Diambil User'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Nama Barang *" fullWidth required value={form.nama_barang}
            onChange={(e) => set('nama_barang', e.target.value)} />
          <Box display="flex" gap={2}>
            <TextField label="Jenis" fullWidth size="small" value={form.jenis}
              onChange={(e) => set('jenis', e.target.value)} />
            <TextField label="Kategori" fullWidth size="small" value={form.kategori}
              onChange={(e) => set('kategori', e.target.value)} />
          </Box>
          <Box display="flex" gap={2}>
            <TextField label="Jumlah *" type="number" size="small" value={form.jumlah}
              onChange={(e) => set('jumlah', e.target.value)}
              inputProps={{ min: 1 }} sx={{ width: 140 }} />
            <TextField select label="Satuan" size="small" value={form.satuan}
              onChange={(e) => set('satuan', e.target.value)} sx={{ width: 120 }}>
              {['pcs', 'box', 'rim', 'pack', 'lusin', 'unit', 'kg', 'botol'].map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            <TextField label={isDiterima ? 'Tanggal Terima' : 'Tanggal Diambil'} type="date" size="small"
              value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)}
              InputLabelProps={{ shrink: true }} fullWidth />
          </Box>
          <TextField label={isDiterima ? 'Sumber / Pemberi (asal barang)' : 'Sumber / Asal Barang'} fullWidth size="small"
            value={form.sumber} onChange={(e) => set('sumber', e.target.value)}
            placeholder={isDiterima ? 'Contoh: Vendor/Supplier, bagian lain, dll' : 'Asal barang yang diambil'} />
          <TextField label={isDiterima ? 'Penerima (user yang menerima)' : 'User yang Mengambil / Meminta *'} fullWidth size="small"
            value={form.penerima} onChange={(e) => set('penerima', e.target.value)}
            placeholder="Nama orang / user" />
          <TextField label="Catatan / Uraian" multiline rows={3} fullWidth value={form.catatan}
            onChange={(e) => set('catatan', e.target.value)}
            placeholder="Dokumentasi & pengingat kondisi barang..." />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="primary" onClick={handleSubmit}
          disabled={loading || !form.nama_barang.trim()}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Simpan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
