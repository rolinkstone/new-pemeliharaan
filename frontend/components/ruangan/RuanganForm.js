// components/ruangan/RuanganForm.js

import React, { useState, useEffect } from 'react';
import {
  Grid,
  TextField,
  FormControl,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
  Paper,
  Box,
} from '@mui/material';
import Ruangan from './models/Ruangan'; // Import class Ruangan

const RuanganForm = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  submitButtonText = 'Simpan',
}) => {
  // State untuk form data - simpan sebagai object biasa
  const [formData, setFormData] = useState({
    id: null,
    kode_ruangan: '',
    nama_ruangan: '',
    deskripsi: '',
    lokasi: '',
    is_active: 1,
    created_at: null
  });
  
  const [errors, setErrors] = useState({});

  // Set initial data if editing
  useEffect(() => {
    if (initialData) {
      // Konversi initialData ke instance Ruangan
      const ruanganInstance = Ruangan.fromAPI(initialData);
      setFormData(ruanganInstance.toJSON()); // Simpan sebagai object biasa
    } else {
      setFormData(new Ruangan().toJSON());
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle switch/checkbox differently
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked ? 1 : 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    // Buat instance Ruangan dari formData untuk validasi
    const ruanganInstance = new Ruangan(formData);
    const result = ruanganInstance.validate();
    
    setErrors(result.errors);
    return result.isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Kirim data sebagai object biasa (bukan instance)
      onSubmit(formData);
    }
  };

  return (
    <form id="ruangan-form" onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        {/* Kode Ruangan */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Kode Ruangan"
            name="kode_ruangan"
            value={formData.kode_ruangan || ''}
            onChange={handleChange}
            disabled={loading}
            required
            error={!!errors.kode_ruangan}
            helperText={errors.kode_ruangan || 'Maksimal 20 karakter, unik'}
            variant="outlined"
            InputProps={{
              sx: { borderRadius: 1.5 }
            }}
          />
        </Grid>

        {/* Nama Ruangan */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Nama Ruangan"
            name="nama_ruangan"
            value={formData.nama_ruangan || ''}
            onChange={handleChange}
            disabled={loading}
            required
            error={!!errors.nama_ruangan}
            helperText={errors.nama_ruangan || 'Maksimal 100 karakter'}
            variant="outlined"
            InputProps={{
              sx: { borderRadius: 1.5 }
            }}
          />
        </Grid>

        {/* Lokasi */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Lokasi"
            name="lokasi"
            value={formData.lokasi || ''}
            onChange={handleChange}
            disabled={loading}
            error={!!errors.lokasi}
            helperText={errors.lokasi || 'Contoh: Gedung A, Lantai 2'}
            variant="outlined"
            InputProps={{
              sx: { borderRadius: 1.5 }
            }}
          />
        </Grid>

        {/* Deskripsi */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Deskripsi"
            name="deskripsi"
            value={formData.deskripsi || ''}
            onChange={handleChange}
            disabled={loading}
            multiline
            rows={3}
            variant="outlined"
            placeholder="Masukkan deskripsi ruangan (opsional)"
            InputProps={{
              sx: { borderRadius: 1.5 }
            }}
          />
        </Grid>

        {/* Status Active */}
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <FormControlLabel
            control={
              <Switch
                name="is_active"
                checked={formData.is_active === 1}
                onChange={handleChange}
                disabled={loading}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">Status Aktif</Typography>
                <Typography variant="caption" color="textSecondary">
                  Nonaktifkan jika ruangan tidak digunakan lagi
                </Typography>
              </Box>
            }
          />
        </Grid>

        {/* Info Created At (only for edit) */}
        {initialData && formData.created_at && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="caption" color="textSecondary">
                ID Ruangan: {formData.id} · Dibuat pada: {new Date(formData.created_at).toLocaleString('id-ID')}
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </form>
  );
};

export default RuanganForm;