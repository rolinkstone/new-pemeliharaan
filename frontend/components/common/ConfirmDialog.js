import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button
} from '@mui/material';

export default function ConfirmDialog({ open, title, message, confirmLabel, onClose, onConfirm, loading }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{title || 'Konfirmasi'}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message || 'Apakah Anda yakin?'}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Batal</Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={loading}>
          {loading ? 'Memproses...' : confirmLabel || 'Ya'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
