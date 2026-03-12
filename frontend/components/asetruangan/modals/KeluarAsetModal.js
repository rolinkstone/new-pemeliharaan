// components/asetruangan/modals/KeluarAsetModal.js

import React, { useState } from 'react';
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { Close as CloseIcon, Warning as WarningIcon } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import idLocale from 'date-fns/locale/id';

const KeluarAsetModal = ({
  open,
  onClose,
  onConfirm,
  asetInfo,
  ruanganInfo,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    tgl_keluar: new Date().toISOString(),
    status: 'dipindah',
    keterangan: '',
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, tgl_keluar: date ? date.toISOString() : null }));
    if (errors.tgl_keluar) {
      setErrors(prev => ({ ...prev, tgl_keluar: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.tgl_keluar) {
      newErrors.tgl_keluar = 'Tanggal keluar harus diisi';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

 // ========== HANDLE SUBMIT ==========
const handleSubmit = () => {
  if (validate()) {
    console.log('📤 Mengirim data keluar:', formData); // Untuk debugging
    onConfirm(formData);
  }
};

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={idLocale}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <WarningIcon />
              <Typography variant="h6">Catat Keluar Aset</Typography>
            </Box>
            <IconButton onClick={onClose} sx={{ color: 'white' }} disabled={loading}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          {asetInfo && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Aset:</strong> {asetInfo.nama_barang} ({asetInfo.kode_barang})
              </Typography>
              <Typography variant="body2">
                <strong>Ruangan:</strong> {ruanganInfo?.nama_ruangan} ({ruanganInfo?.kode_ruangan})
              </Typography>
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <DateTimePicker
              label="Tanggal Keluar *"
              value={formData.tgl_keluar ? new Date(formData.tgl_keluar) : null}
              onChange={handleDateChange}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: !!errors.tgl_keluar,
                  helperText: errors.tgl_keluar,
                  sx: { mb: 2 }
                }
              }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={formData.status}
                onChange={handleChange}
                label="Status"
              >
                
                <MenuItem value="dihapuskan">Dihapuskan (keluar dari inventaris)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Keterangan"
              name="keterangan"
              value={formData.keterangan}
              onChange={handleChange}
              multiline
              rows={3}
              placeholder="Masukkan alasan atau keterangan keluar"
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Button onClick={onClose} variant="outlined" disabled={loading}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="warning"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Menyimpan...' : 'Konfirmasi Keluar'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default KeluarAsetModal;