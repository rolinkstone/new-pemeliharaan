import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography
} from '@mui/material';

export default function RejectDialog({ open, title, onClose, onConfirm, loading }) {
  const [alasan, setAlasan] = useState('');

  const handleConfirm = () => {
    onConfirm(alasan);
    setAlasan('');
  };

  const handleClose = () => {
    onClose();
    setAlasan('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{title || 'Alasan Ditolak'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Masukkan alasan mengapa permintaan ini ditolak:
        </Typography>
        <TextField
          autoFocus
          label="Alasan"
          multiline
          rows={3}
          fullWidth
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="Isi alasan penolakan..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Batal</Button>
        <Button onClick={handleConfirm} color="error" variant="contained" disabled={loading || !alasan.trim()}>
          {loading ? 'Memproses...' : 'Tolak'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
