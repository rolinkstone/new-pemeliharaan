// components/laporanrusak/modals/KonfirmasiUserModal.js
// User (pelapor) mengonfirmasi penyelesaian laporan -> selesai

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Chip, CircularProgress,
} from '@mui/material';

export default function KonfirmasiUserModal({ open, onClose, onConfirm, laporan, loading }) {
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
      <DialogTitle sx={{ fontWeight: 600 }}>Konfirmasi Penyelesaian (User)</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {laporan && (
            <Box>
              <Typography variant="body2" fontWeight={600}>{laporan.nomor_laporan}</Typography>
              <Typography variant="caption" color="text.secondary">{laporan.aset_nama} — {laporan.ruangan_nama}</Typography>
              {laporan.kabag_confirm_by && <Chip size="small" label={`Dikonfirmasi Kabag TU: ${laporan.kabag_confirm_by}`} sx={{ ml: 1 }} />}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            Konfirmasi bahwa kerusakan telah diperbaiki. Setelah ini laporan dinyatakan selesai.
          </Typography>
          <TextField
            label="Catatan" multiline rows={3} fullWidth value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan pelapor..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="success" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Konfirmasi Selesai
        </Button>
      </DialogActions>
    </Dialog>
  );
}
