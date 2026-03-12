// components/asetruangan/modals/DeleteConfirmationModal.js

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Avatar,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

const DeleteConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  itemName,
  loading = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ bgcolor: 'transparent', color: 'white' }}>
            <WarningIcon />
          </Avatar>
          <Typography variant="h6">Konfirmasi Hapus</Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <DialogContentText>
          Apakah Anda yakin ingin menghapus data posisi aset berikut?
        </DialogContentText>
        <Typography
          variant="body1"
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontWeight: 'bold',
            border: '1px solid',
            borderColor: 'grey.300',
          }}
        >
          {itemName || 'Data posisi aset ini'}
        </Typography>
        <Typography variant="caption" color="error" sx={{ mt: 2, display: 'block' }}>
          ⚠️ Tindakan ini tidak dapat dibatalkan! Data akan dihapus permanen.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Button onClick={onClose} variant="outlined" color="inherit" disabled={loading}>
          Batal
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Menghapus...' : 'Hapus'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmationModal;