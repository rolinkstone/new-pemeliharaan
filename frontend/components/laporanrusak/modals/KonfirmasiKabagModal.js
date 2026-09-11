// components/laporanrusak/modals/KonfirmasiKabagModal.js
// Kabag TU mengonfirmasi perbaikan sudah selesai -> menunggu_konfirmasi_user

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Chip, CircularProgress,
} from '@mui/material';

export default function KonfirmasiKabagModal({ open, onClose, onConfirm, laporan, loading }) {
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (!open) return;
    setCatatan('');
  }, [open]);

  const handleSubmit = () => {
    onConfirm({ catatan: catatan.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Konfirmasi Perbaikan (Kabag TU)</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {laporan && (
            <Box>
              <Typography variant="body2" fontWeight={600}>{laporan.nomor_laporan}</Typography>
              <Typography variant="caption" color="text.secondary">{laporan.aset_nama} — {laporan.ruangan_nama}</Typography>
              {laporan.perbaikan_done_by && <Chip size="small" label={`Perbaikan oleh: ${laporan.perbaikan_done_by}`} sx={{ ml: 1 }} />}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            Anda akan mengonfirmasi bahwa perbaikan telah selesai. Setelah ini, laporan menunggu konfirmasi User (pelapor).
          </Typography>
          <TextField
            label="Catatan" multiline rows={3} fullWidth value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan konfirmasi Kabag TU..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="success" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Konfirmasi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
