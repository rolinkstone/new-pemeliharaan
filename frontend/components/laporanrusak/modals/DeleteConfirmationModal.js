// components/laporanrusak/modals/DeleteConfirmationModal.js

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const DeleteConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  itemName = 'item ini',
  loading = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Konfirmasi Hapus</Typography>
          <IconButton onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box textAlign="center" py={2}>
            <WarningIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
            <DialogContentText>
              Apakah Anda yakin ingin menghapus <strong>{itemName}</strong>?
              <br />
              Tindakan ini tidak dapat dibatalkan.
            </DialogContentText>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Batal
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          disabled={loading}
        >
          Hapus
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmationModal;