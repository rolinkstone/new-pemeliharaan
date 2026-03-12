// components/aset/modals/AsetModal.js

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import AsetForm from '../AsetForm';

const AsetModal = ({
  open,
  onClose,
  onSubmit,
  initialData,
  title,
  loading = false,
  session,
}) => {
  const handleSubmit = async (formData) => {
    await onSubmit(formData);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, bgcolor: 'primary.main', color: 'white' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            {title}
          </Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ color: 'white' }}
            disabled={loading}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <AsetForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={onClose}
          loading={loading}
          submitButtonText={initialData ? 'Update' : 'Simpan'}
          session={session}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Button onClick={onClose} variant="outlined" color="inherit" disabled={loading}>
          Batal
        </Button>
        <Button
          type="submit"
          form="aset-form"
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Menyimpan...' : initialData ? 'Update' : 'Simpan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AsetModal;