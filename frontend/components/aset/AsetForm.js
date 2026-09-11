// components/aset/AsetForm.js

import React, { useState, useEffect } from 'react';
import {
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Typography,
  Divider,
  Paper,
} from '@mui/material';
import * as asetApi from './api/asetApi';

const AsetForm = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  submitButtonText = 'Simpan',
  session,
}) => {
  const [formData, setFormData] = useState({
    jenis_bmn: '',
    nama_satker: 'BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA',
    kode_barang: '',
    nup: '',
    nama_barang: '',
    status_bmn: 'Aktif',
    merk: '',
    tipe: '',
    kondisi: 'Baik',
    intra_extra: 'Intra',
    tanggal_perolehan: '',
  });

  const [errors, setErrors] = useState({});
  const [jenisOptions, setJenisOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Load options
  useEffect(() => {
    if (!session) return;
    
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const result = await asetApi.fetchJenisList(session);
        if (result?.success) {
          setJenisOptions(result.data || []);
        }
      } catch (error) {
        console.error('Error loading jenis options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [session]);

  // Set initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        jenis_bmn: initialData.jenis_bmn || '',
        nama_satker: initialData.nama_satker || 'BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA',
        kode_barang: initialData.kode_barang || '',
        nup: initialData.nup || '',
        nama_barang: initialData.nama_barang || '',
        status_bmn: initialData.status_bmn || 'Aktif',
        merk: initialData.merk || '',
        tipe: initialData.tipe || '',
        kondisi: initialData.kondisi || 'Baik',
        intra_extra: initialData.intra_extra || 'Intra',
        tanggal_perolehan: initialData.tanggal_perolehan?.split('T')[0] || '',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.jenis_bmn) {
      newErrors.jenis_bmn = 'Jenis BMN harus diisi';
    }
    if (!formData.nama_barang) {
      newErrors.nama_barang = 'Nama barang harus diisi';
    }
    if (!formData.kode_barang) {
      newErrors.kode_barang = 'Kode barang harus diisi';
    }
    if (formData.nup && isNaN(formData.nup)) {
      newErrors.nup = 'NUP harus berupa angka';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const kondisiOptions = ['Baik', 'Rusak Ringan', 'Rusak Berat'];
  const statusOptions = ['Aktif', 'Tidak Aktif'];
  const intraExtraOptions = ['Intra', 'Ekstra'];

  return (
    <form id="aset-form" onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        {/* Baris 1: Jenis BMN & Nama Satker */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required error={!!errors.jenis_bmn}>
            <InputLabel>Jenis BMN</InputLabel>
            <Select
              name="jenis_bmn"
              value={formData.jenis_bmn}
              label="Jenis BMN"
              onChange={handleChange}
              disabled={loading || loadingOptions}
            >
              <MenuItem value="">Pilih Jenis BMN</MenuItem>
              {jenisOptions.map((jenis) => (
                <MenuItem key={jenis} value={jenis}>
                  {jenis}
                </MenuItem>
              ))}
            </Select>
            {errors.jenis_bmn && (
              <Typography variant="caption" color="error">
                {errors.jenis_bmn}
              </Typography>
            )}
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Nama Satker"
            name="nama_satker"
            value={formData.nama_satker}
            onChange={handleChange}
            disabled={loading}
            InputProps={{
              readOnly: true,
            }}
          />
        </Grid>

        {/* Baris 2: Kode Barang & NUP */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Kode Barang"
            name="kode_barang"
            value={formData.kode_barang}
            onChange={handleChange}
            disabled={loading}
            required
            error={!!errors.kode_barang}
            helperText={errors.kode_barang}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="NUP"
            name="nup"
            type="number"
            value={formData.nup}
            onChange={handleChange}
            disabled={loading}
            error={!!errors.nup}
            helperText={errors.nup || 'Nomor Urut Pendaftaran'}
          />
        </Grid>

        {/* Baris 3: Nama Barang */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Nama Barang"
            name="nama_barang"
            value={formData.nama_barang}
            onChange={handleChange}
            disabled={loading}
            required
            error={!!errors.nama_barang}
            helperText={errors.nama_barang}
            multiline
            rows={2}
          />
        </Grid>

        {/* Baris 4: Merk & Tipe */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Merk"
            name="merk"
            value={formData.merk}
            onChange={handleChange}
            disabled={loading}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Tipe"
            name="tipe"
            value={formData.tipe}
            onChange={handleChange}
            disabled={loading}
          />
        </Grid>

        {/* Baris 5: Status, Kondisi, Intra/Extra */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Status BMN</InputLabel>
            <Select
              name="status_bmn"
              value={formData.status_bmn}
              label="Status BMN"
              onChange={handleChange}
              disabled={loading}
            >
              {statusOptions.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Kondisi</InputLabel>
            <Select
              name="kondisi"
              value={formData.kondisi}
              label="Kondisi"
              onChange={handleChange}
              disabled={loading}
            >
              {kondisiOptions.map((kondisi) => (
                <MenuItem key={kondisi} value={kondisi}>
                  {kondisi}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Intra/Extra</InputLabel>
            <Select
              name="intra_extra"
              value={formData.intra_extra}
              label="Intra/Extra"
              onChange={handleChange}
              disabled={loading}
            >
              {intraExtraOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Baris 6: Tanggal Perolehan */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Tanggal Perolehan"
            name="tanggal_perolehan"
            type="date"
            value={formData.tanggal_perolehan}
            onChange={handleChange}
            disabled={loading}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Grid>
      </Grid>
    </form>
  );
};

export default AsetForm;