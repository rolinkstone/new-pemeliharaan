// components/laporanrusak/modals/CatatPerbaikanModal.js
// PIC/Admin mencatat perbaikan selesai (hasil, tanggal, biaya aktual, dll)
// Setelah dicatat, status -> menunggu_konfirmasi_kabag

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Chip, Alert, CircularProgress, MenuItem,
} from '@mui/material';

export default function CatatPerbaikanModal({ open, onClose, onConfirm, laporan, loading }) {
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().split('T')[0]);
  const [hasil, setHasil] = useState('internal');
  const [namaVendor, setNamaVendor] = useState('');
  const [noKontrak, setNoKontrak] = useState('');
  const [rating, setRating] = useState('');
  const [biayaAktual, setBiayaAktual] = useState(laporan?.estimasi_biaya || '');
  const [dokumentasi, setDokumentasi] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTanggalSelesai(new Date().toISOString().split('T')[0]);
    setHasil('internal');
    setNamaVendor('');
    setNoKontrak('');
    setRating('');
    setBiayaAktual(laporan?.estimasi_biaya || '');
    setDokumentasi('');
    setRekomendasi('');
    setCatatan('');
    setError('');
  }, [open, laporan]);

  const handleSubmit = () => {
    setError('');
    if (hasil === 'eksternal' && !namaVendor.trim()) {
      setError('Nama vendor wajib diisi untuk perbaikan eksternal');
      return;
    }
    onConfirm({
      hasil_perbaikan: hasil,
      tanggal_selesai: tanggalSelesai,
      rating: (hasil === 'internal' || hasil === 'eksternal') && rating ? parseInt(rating, 10) : null,
      biaya_aktual: biayaAktual ? parseFloat(biayaAktual) : null,
      dokumentasi: dokumentasi || null,
      rekomendasi: rekomendasi || null,
      nama_vendor: hasil === 'eksternal' ? namaVendor : null,
      no_kontrak: hasil === 'eksternal' ? noKontrak : null,
      catatan: catatan || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Catat Perbaikan Selesai</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {laporan && (
            <Box>
              <Typography variant="body2" fontWeight={600}>{laporan.nomor_laporan}</Typography>
              <Typography variant="caption" color="text.secondary">{laporan.aset_nama} — {laporan.ruangan_nama}</Typography>
              {laporan.kisaran_biaya && <Chip size="small" label={`Kisaran biaya: ${laporan.kisaran_biaya}`} sx={{ ml: 1 }} />}
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <TextField label="Tanggal Selesai" type="date" fullWidth required size="small"
            value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)}
            InputLabelProps={{ shrink: true }} />

          <TextField select label="Hasil Perbaikan" fullWidth size="small" value={hasil}
            onChange={(e) => setHasil(e.target.value)}>
            <MenuItem value="internal">Tim Internal</MenuItem>
            <MenuItem value="eksternal">Vendor Eksternal</MenuItem>
            <MenuItem value="gagal">Gagal</MenuItem>
          </TextField>

          {hasil === 'eksternal' && (
            <>
              <TextField label="Nama Vendor" fullWidth size="small" required value={namaVendor}
                onChange={(e) => setNamaVendor(e.target.value)} />
              <TextField label="No. Kontrak" fullWidth size="small" value={noKontrak}
                onChange={(e) => setNoKontrak(e.target.value)} />
            </>
          )}

          {(hasil === 'internal' || hasil === 'eksternal') && (
            <TextField select label="Rating (1-5)" fullWidth size="small" value={rating}
              onChange={(e) => setRating(e.target.value)}>
              {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={n}>{n} — {'⭐'.repeat(n)}</MenuItem>)}
            </TextField>
          )}

          <TextField label="Biaya Aktual (Rp)" type="number" fullWidth size="small" value={biayaAktual}
            onChange={(e) => setBiayaAktual(e.target.value)} />
          <TextField label="Dokumentasi (link)" fullWidth size="small" value={dokumentasi}
            onChange={(e) => setDokumentasi(e.target.value)} />
          <TextField label="Rekomendasi" multiline rows={2} fullWidth value={rekomendasi}
            onChange={(e) => setRekomendasi(e.target.value)} />
          <TextField label="Catatan" multiline rows={2} fullWidth value={catatan}
            onChange={(e) => setCatatan(e.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Simpan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
