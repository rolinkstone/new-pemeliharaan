// components/laporanrusak/modals/PPKVerifikasiModal.js
// PPK menerima laporan yang sudah diketahui Katim, mengetahui kerusakan
// dan mengisi detail kisaran biaya perbaikan (setuju/tolak)

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Chip, CircularProgress,
  RadioGroup, FormControlLabel, Radio,
} from '@mui/material';

export default function PPKVerifikasiModal({ open, onClose, onConfirm, laporan, loading }) {
  const [keputusan, setKeputusan] = useState('setuju');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (!open) return;
    setKeputusan('setuju');
    setCatatan('');
  }, [open]);

  const handleSubmit = () => {
    onConfirm({ keputusan, catatan: catatan.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Verifikasi PPK</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {laporan && (
            <Box>
              <Typography variant="body2" fontWeight={600}>{laporan.nomor_laporan}</Typography>
              <Typography variant="caption" color="text.secondary">{laporan.aset_nama} — {laporan.ruangan_nama}</Typography>
              {laporan.katim_nama && <Chip size="small" label={`Diketahui Katim: ${laporan.katim_nama}`} sx={{ ml: 1 }} />}
            </Box>
          )}
          <RadioGroup row value={keputusan} onChange={(e) => setKeputusan(e.target.value)}>
            <FormControlLabel value="setuju" control={<Radio size="small" />} label="Setujui" />
            <FormControlLabel value="tolak" control={<Radio size="small" />} label="Tolak" />
          </RadioGroup>

          <TextField
            label="Catatan" multiline rows={2} fullWidth value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder={keputusan === 'tolak' ? 'Alasan penolakan...' : 'Catatan PPK...'}
          />
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
