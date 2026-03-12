import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  Paper,
  Box,
  Autocomplete,
  Chip,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Search as SearchIcon } from '@mui/icons-material';
import idLocale from 'date-fns/locale/id';
import AsetRuangan from './models/AsetRuangan';
import * as asetRuanganApi from './api/asetRuanganApi';
import { useSession } from 'next-auth/react';

// Pre-compile search function for better performance
const createSearchPredicate = (searchText) => {
  if (!searchText) return () => true;
  
  const terms = searchText.toLowerCase().split(' ').filter(t => t.length > 0);
  if (terms.length === 0) return () => true;
  
  return (aset) => {
    const searchableText = [
      aset.kode_barang,
      aset.nama_barang,
      aset.merk,
      aset.nup?.toString(),
      aset.id?.toString()
    ].filter(Boolean).join(' ').toLowerCase();
    
    return terms.every(term => searchableText.includes(term));
  };
};

const AsetRuanganForm = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  submitButtonText = 'Simpan',
  asetId = null,
  ruanganId = null,
}) => {
  const { data: session } = useSession();
  
  // State untuk form data
  const [formData, setFormData] = useState({
    id: null,
    aset_id: asetId || '',
    ruangan_id: ruanganId || '',
    tgl_masuk: new Date().toISOString(),
    tgl_keluar: null,
    status: 'aktif',
    keterangan: '',
  });
  
  // State untuk errors
  const [errors, setErrors] = useState({});
  
  // State untuk options
  const [asetOptions, setAsetOptions] = useState([]);
  const [ruanganOptions, setRuanganOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [displayOptions, setDisplayOptions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load options for dropdowns
  useEffect(() => {
    if (!session) return;
    
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [asetResult, ruanganResult] = await Promise.all([
          asetRuanganApi.fetchAsetOptions(session),
          asetRuanganApi.fetchRuanganOptions(session)
        ]);

        if (asetResult?.success) {
          setAsetOptions(asetResult.data || []);
          // Set initial display options
          setDisplayOptions((asetResult.data || []).slice(0, 50));
        }
        if (ruanganResult?.success) {
          setRuanganOptions(ruanganResult.data || []);
        }
      } catch (error) {
        console.error('Error loading options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [session]);

  // Set initial data if editing
  useEffect(() => {
    if (initialData) {
      const instance = AsetRuangan.fromAPI(initialData);
      setFormData(instance.toJSON());
      if (instance.aset) {
        const displayText = `${instance.aset.kode_barang} - ${instance.aset.nama_barang}`;
        setInputValue(displayText);
      }
    }
  }, [initialData]);

  // Optimasi pencarian dengan Web Worker-like approach
  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setDisplayOptions(asetOptions.slice(0, 50));
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Gunakan requestAnimationFrame untuk menghindari blocking UI
    const searchFrame = requestAnimationFrame(() => {
      const searchLower = inputValue.toLowerCase();
      const terms = searchLower.split(' ').filter(t => t.length > 0);
      
      // Batasi pencarian jika terlalu banyak term
      if (terms.length > 3) {
        setDisplayOptions([]);
        setIsSearching(false);
        return;
      }

      // Lakukan pencarian dengan batasan waktu
      const startTime = performance.now();
      const results = [];
      
      for (let i = 0; i < asetOptions.length; i++) {
        const aset = asetOptions[i];
        
        // Cek waktu setiap 100 item untuk menghindari blocking
        if (i % 100 === 0 && performance.now() - startTime > 16) {
          // Jika sudah lebih dari 16ms (1 frame), lanjutkan di frame berikutnya
          setTimeout(() => {
            const remaining = asetOptions.slice(i).filter(aset => {
              const searchableText = [
                aset.kode_barang,
                aset.nama_barang,
                aset.merk,
                aset.nup?.toString(),
                aset.id?.toString()
              ].filter(Boolean).join(' ').toLowerCase();
              
              return terms.every(term => searchableText.includes(term));
            });
            
            setDisplayOptions([...results, ...remaining].slice(0, 100));
            setIsSearching(false);
          }, 0);
          return;
        }
        
        const searchableText = [
          aset.kode_barang,
          aset.nama_barang,
          aset.merk,
          aset.nup?.toString(),
          aset.id?.toString()
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (terms.every(term => searchableText.includes(term))) {
          results.push(aset);
          if (results.length >= 100) break; // Batasi hasil
        }
      }
      
      setDisplayOptions(results);
      setIsSearching(false);
    });

    return () => cancelAnimationFrame(searchFrame);
  }, [inputValue, asetOptions]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (name, date) => {
    setFormData(prev => ({ ...prev, [name]: date ? date.toISOString() : null }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const instance = new AsetRuangan(formData);
    const result = instance.validate();
    setErrors(result.errors);
    return result.isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  // Get selected aset and ruangan objects
  const selectedAset = asetOptions.find(a => a.id === formData.aset_id);
  const selectedRuangan = ruanganOptions.find(r => r.id === formData.ruangan_id);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={idLocale}>
      <form id="aset-ruangan-form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Pilih Aset dengan Search - Optimasi */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={displayOptions}
              loading={loadingOptions || isSearching}
              getOptionLabel={(option) => {
                if (!option) return '';
                return `${option.kode_barang || ''} - ${option.nama_barang || ''}`;
              }}
              value={selectedAset || null}
              onChange={(event, newValue) => {
                setFormData(prev => ({ ...prev, aset_id: newValue?.id || '' }));
                if (errors.aset_id) {
                  setErrors(prev => ({ ...prev, aset_id: '' }));
                }
              }}
              onInputChange={(event, newInputValue) => {
                setInputValue(newInputValue);
              }}
              inputValue={inputValue}
              disabled={loading || !!asetId}
              filterOptions={(x) => x} // Nonaktifkan filtering internal
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih Aset"
                  required
                  error={!!errors.aset_id}
                  helperText={
                    errors.aset_id || 
                    (isSearching ? 'Mencari...' : 
                     inputValue ? `Ditemukan ${displayOptions.length} aset` : 
                     'Ketik minimal 2 karakter untuk mencari')
                  }
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box sx={{ width: '100%', py: 0.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight="bold">
                        {option.kode_barang} - {option.nama_barang}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={`ID: ${option.id}`} 
                        variant="outlined"
                        sx={{ ml: 1, height: 20 }}
                      />
                    </Box>
                    <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                      {option.merk && (
                        <Typography variant="caption" color="textSecondary">
                          Merk: {option.merk}
                        </Typography>
                      )}
                      {option.nup && (
                        <Typography variant="caption" color="textSecondary">
                          NUP: {option.nup}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </li>
              )}
              noOptionsText={
                inputValue ? 
                `Tidak ada aset dengan kata kunci "${inputValue}"` : 
                'Ketik minimal 2 karakter untuk mencari aset'
              }
              loadingText="Memuat data aset..."
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              ListboxProps={{
                style: { maxHeight: 400, overflow: 'auto' }
              }}
              // Tambahkan props untuk optimasi
              componentsProps={{
                popper: {
                  style: { width: 'fit-content' }
                }
              }}
            />
          </Grid>

          {/* Pilih Ruangan dengan Search */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={ruanganOptions}
              loading={loadingOptions}
              getOptionLabel={(option) => {
                if (!option) return '';
                return `${option.kode_ruangan || ''} - ${option.nama_ruangan || ''}`;
              }}
              value={selectedRuangan || null}
              onChange={(event, newValue) => {
                setFormData(prev => ({ ...prev, ruangan_id: newValue?.id || '' }));
                if (errors.ruangan_id) {
                  setErrors(prev => ({ ...prev, ruangan_id: '' }));
                }
              }}
              disabled={loading || !!ruanganId}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih Ruangan"
                  required
                  error={!!errors.ruangan_id}
                  helperText={errors.ruangan_id || 'Ketik untuk mencari ruangan'}
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box sx={{ width: '100%', py: 0.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight="bold">
                        {option.kode_ruangan} - {option.nama_ruangan}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={`ID: ${option.id}`} 
                        variant="outlined"
                        sx={{ ml: 1, height: 20 }}
                      />
                    </Box>
                    {option.lokasi && (
                      <Typography variant="caption" color="textSecondary">
                        Lokasi: {option.lokasi}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              noOptionsText="Tidak ada ruangan yang ditemukan"
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              ListboxProps={{
                style: { maxHeight: 400, overflow: 'auto' }
              }}
            />
          </Grid>

          {/* ... rest of the form (Tanggal Masuk, Tanggal Keluar, Status, etc) ... */}
          
          {/* Tanggal Masuk */}
          <Grid item xs={12} md={6}>
            <DateTimePicker
              label="Tanggal Masuk *"
              value={formData.tgl_masuk ? new Date(formData.tgl_masuk) : null}
              onChange={(date) => handleDateChange('tgl_masuk', date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: !!errors.tgl_masuk,
                  helperText: errors.tgl_masuk,
                  disabled: loading
                }
              }}
            />
          </Grid>

          {/* Tanggal Keluar */}
          <Grid item xs={12} md={6}>
            <DateTimePicker
              label="Tanggal Keluar"
              value={formData.tgl_keluar ? new Date(formData.tgl_keluar) : null}
              onChange={(date) => handleDateChange('tgl_keluar', date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.tgl_keluar,
                  helperText: errors.tgl_keluar || 'Kosongkan jika masih aktif',
                  disabled: loading
                }
              }}
            />
          </Grid>

          {/* Status */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={formData.status}
                onChange={handleChange}
                label="Status"
                disabled={loading}
              >
                <MenuItem value="aktif">Aktif</MenuItem>
                <MenuItem value="dipindah">Dipindah</MenuItem>
                <MenuItem value="dihapuskan">Dihapuskan</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Info Tambahan untuk status tertentu */}
          {formData.status !== 'aktif' && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
                <Typography variant="body2" color="warning.dark">
                  {formData.status === 'dipindah' && '⏳ Aset ini telah dipindah ke ruangan lain.'}
                  {formData.status === 'dihapuskan' && '🗑️ Aset ini telah dihapuskan dari inventaris.'}
                </Typography>
              </Paper>
            </Grid>
          )}

          {/* Keterangan */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Keterangan"
              name="keterangan"
              value={formData.keterangan || ''}
              onChange={handleChange}
              disabled={loading}
              multiline
              rows={3}
              placeholder="Masukkan keterangan tambahan (opsional)"
            />
          </Grid>

          {/* Info Aset yang Dipilih */}
          {selectedAset && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Informasi Aset Terpilih:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip size="small" label={`ID: ${selectedAset.id}`} color="primary" variant="outlined" />
                  <Chip size="small" label={`Kode: ${selectedAset.kode_barang}`} />
                  <Chip size="small" label={`Nama: ${selectedAset.nama_barang}`} />
                  {selectedAset.nup && <Chip size="small" label={`NUP: ${selectedAset.nup}`} />}
                  {selectedAset.merk && <Chip size="small" label={`Merk: ${selectedAset.merk}`} />}
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Info Ruangan yang Dipilih */}
          {selectedRuangan && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Informasi Ruangan Terpilih:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip size="small" label={`ID: ${selectedRuangan.id}`} color="info" variant="outlined" />
                  <Chip size="small" label={`Kode: ${selectedRuangan.kode_ruangan}`} />
                  <Chip size="small" label={`Nama: ${selectedRuangan.nama_ruangan}`} />
                  {selectedRuangan.lokasi && <Chip size="small" label={`Lokasi: ${selectedRuangan.lokasi}`} />}
                  
                  {selectedRuangan.is_active == 1 || selectedRuangan.is_active === true ? (
                    <Chip size="small" label="Ruangan Aktif" color="success" sx={{ fontWeight: 600 }} />
                  ) : (
                    <Chip size="small" label="Ruangan Tidak Aktif" color="error" sx={{ fontWeight: 600 }} />
                  )}
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Info Created At (only for edit) */}
          {initialData && formData.created_at && (
            <Grid item xs={12}>
              <Divider />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                ID: {formData.id} · Dicatat pada: {new Date(formData.created_at).toLocaleString('id-ID')}
              </Typography>
            </Grid>
          )}
        </Grid>
      </form>
    </LocalizationProvider>
  );
};

export default AsetRuanganForm;