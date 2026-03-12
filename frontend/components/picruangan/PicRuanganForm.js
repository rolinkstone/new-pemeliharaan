import React, { useState, useEffect, useMemo } from 'react';
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Search as SearchIcon, Person as PersonIcon } from '@mui/icons-material';
import idLocale from 'date-fns/locale/id';
import PicRuangan from './models/PicRuangan';
import * as picRuanganApi from './api/picRuanganApi';
import { useSession } from 'next-auth/react';

const PicRuanganForm = ({
  initialData,
  onSubmit,
  loading = false,
}) => {
  const { data: session } = useSession();
  
  const [formData, setFormData] = useState({
    id: null,
    user_id: '',
    ruangan_id: '',
    tgl_penugasan: new Date().toISOString().split('T')[0],
    tgl_berakhir: null,
    status: 'aktif',
  });
  
  const [errors, setErrors] = useState({});
  
  const [userOptions, setUserOptions] = useState([]);
  const [ruanganOptions, setRuanganOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [ruanganSearchText, setRuanganSearchText] = useState('');

  // Load options from API
 // components/picruangan/PicRuanganForm.js

// Di bagian useEffect untuk load options
useEffect(() => {
    if (!session) return;
    
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        // Gunakan fetchUserOptions yang sudah diperbaiki
        const [userResult, ruanganResult] = await Promise.all([
          picRuanganApi.fetchUserOptions(session), // Ini akan mengirim role=pic_ruangan
          picRuanganApi.fetchRuanganOptions(session)
        ]);

        if (userResult?.success) {
          console.log('📥 User PIC options loaded:', userResult.data?.length || 0);
          console.log('📋 Data user dengan role pic_ruangan:', userResult.data);
          
          // Hanya set userOptions dengan data yang benar
          setUserOptions(userResult.data || []);
        } else {
          console.error('Failed to load user options:', userResult?.message);
          setUserOptions([]);
        }

        if (ruanganResult?.success) {
          console.log('📥 Ruangan options loaded:', ruanganResult.data?.length || 0);
          setRuanganOptions(ruanganResult.data || []);
        } else {
          console.error('Failed to load ruangan options:', ruanganResult?.message);
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
      console.log('📋 Initial data for edit:', initialData);
      const instance = PicRuangan.fromAPI(initialData);
      setFormData(instance.toJSON());
      
      // Set search text for user if available
      if (instance.user_detail) {
        setUserSearchText(instance.user_detail.nama || '');
      } else if (instance.user_nama) {
        setUserSearchText(instance.user_nama);
      }
    }
  }, [initialData]);

  // Filter user options based on search text
  const filteredUserOptions = useMemo(() => {
    if (!userSearchText || userSearchText.length < 2) {
      return userOptions.slice(0, 50); // Tampilkan 50 pertama jika tidak ada pencarian
    }
    
    const searchLower = userSearchText.toLowerCase();
    return userOptions.filter(user => {
      return (
        (user.nama && user.nama.toLowerCase().includes(searchLower)) ||
        (user.nip && user.nip.toLowerCase().includes(searchLower)) ||
        (user.username && user.username.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.user_id && user.user_id.toLowerCase().includes(searchLower))
      );
    }).slice(0, 100); // Batasi hasil pencarian
  }, [userOptions, userSearchText]);

  // Filter ruangan options based on search text
  const filteredRuanganOptions = useMemo(() => {
    if (!ruanganSearchText || ruanganSearchText.length < 2) {
      return ruanganOptions;
    }
    
    const searchLower = ruanganSearchText.toLowerCase();
    return ruanganOptions.filter(ruangan => {
      return (
        (ruangan.kode_ruangan && ruangan.kode_ruangan.toLowerCase().includes(searchLower)) ||
        (ruangan.nama_ruangan && ruangan.nama_ruangan.toLowerCase().includes(searchLower)) ||
        (ruangan.lokasi && ruangan.lokasi.toLowerCase().includes(searchLower))
      );
    });
  }, [ruanganOptions, ruanganSearchText]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (name, date) => {
    const value = date ? date.toISOString().split('T')[0] : null;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const instance = new PicRuangan(formData);
    const result = instance.validate();
    setErrors(result.errors);
    return result.isValid;
  };

 // ========== HANDLE SUBMIT ==========
const handleSubmit = (e) => {
  e.preventDefault();
  if (validate()) {
    // Format tanggal sebelum dikirim
    const formattedData = {
      ...formData,
      tgl_penugasan: formData.tgl_penugasan, // Ini sudah format YYYY-MM-DD dari DatePicker
      tgl_berakhir: formData.tgl_berakhir ? formData.tgl_berakhir.split('T')[0] : null
    };
    console.log('📤 Submitting formatted data:', formattedData);
    onSubmit(formattedData);
  }
};

  const selectedUser = userOptions.find(u => u.user_id === formData.user_id);
  const selectedRuangan = ruanganOptions.find(r => r.id === formData.ruangan_id);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={idLocale}>
      <form id="pic-ruangan-form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Pilih PIC dari Keycloak */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={filteredUserOptions}
              loading={loadingOptions}
              getOptionLabel={(option) => {
                if (!option) return '';
                return `${option.nama || ''}${option.nip ? ` (${option.nip})` : ''}`;
              }}
              value={selectedUser || null}
              onChange={(event, newValue) => {
                setFormData(prev => ({ ...prev, user_id: newValue?.user_id || '' }));
                if (errors.user_id) {
                  setErrors(prev => ({ ...prev, user_id: '' }));
                }
              }}
              onInputChange={(event, newInputValue) => {
                setUserSearchText(newInputValue);
              }}
              inputValue={userSearchText}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih PIC"
                  required
                  error={!!errors.user_id}
                  helperText={errors.user_id || 'Cari berdasarkan nama, NIP, atau email'}
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
                    <Box display="flex" alignItems="center" gap={1}>
                      <PersonIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {option.nama}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" component="div">
                          {option.nip && `NIP: ${option.nip} • `}
                          {option.username}
                        </Typography>
                        {option.jabatan && option.jabatan !== '-' && (
                          <Typography variant="caption" color="textSecondary">
                            {option.jabatan}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </li>
              )}
              noOptionsText={
                userSearchText.length < 2 
                  ? 'Ketik minimal 2 karakter untuk mencari' 
                  : 'Tidak ada user ditemukan'
              }
              loadingText="Memuat data user..."
              isOptionEqualToValue={(option, value) => option.user_id === value?.user_id}
              filterOptions={(x) => x} // Nonaktifkan filter internal
            />
          </Grid>

          {/* Pilih Ruangan */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={filteredRuanganOptions}
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
              onInputChange={(event, newInputValue) => {
                setRuanganSearchText(newInputValue);
              }}
              inputValue={ruanganSearchText}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih Ruangan"
                  required
                  error={!!errors.ruangan_id}
                  helperText={errors.ruangan_id || 'Cari berdasarkan kode atau nama ruangan'}
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
                    <Typography variant="body2" fontWeight="bold">
                      {option.kode_ruangan} - {option.nama_ruangan}
                    </Typography>
                    {option.lokasi && (
                      <Typography variant="caption" color="textSecondary">
                        Lokasi: {option.lokasi}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              noOptionsText={
                ruanganSearchText.length < 2
                  ? 'Ketik minimal 2 karakter untuk mencari'
                  : 'Tidak ada ruangan ditemukan'
              }
              loadingText="Memuat data ruangan..."
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              filterOptions={(x) => x} // Nonaktifkan filter internal
            />
          </Grid>

          {/* Tanggal Penugasan */}
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Tanggal Penugasan *"
              value={formData.tgl_penugasan ? new Date(formData.tgl_penugasan) : null}
              onChange={(date) => handleDateChange('tgl_penugasan', date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: !!errors.tgl_penugasan,
                  helperText: errors.tgl_penugasan,
                  disabled: loading
                }
              }}
            />
          </Grid>

          {/* Tanggal Berakhir */}
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Tanggal Berakhir"
              value={formData.tgl_berakhir ? new Date(formData.tgl_berakhir) : null}
              onChange={(date) => handleDateChange('tgl_berakhir', date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.tgl_berakhir,
                  helperText: errors.tgl_berakhir || 'Kosongkan jika masih berlaku',
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
                <MenuItem value="nonaktif">Nonaktif</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Detail User Terpilih */}
          {selectedUser && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Detail User Terpilih:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip size="small" label={`Nama: ${selectedUser.nama}`} />
                  {selectedUser.nip && selectedUser.nip !== '-' && (
                    <Chip size="small" label={`NIP: ${selectedUser.nip}`} />
                  )}
                  {selectedUser.email && (
                    <Chip size="small" label={`Email: ${selectedUser.email}`} />
                  )}
                  {selectedUser.jabatan && selectedUser.jabatan !== '-' && (
                    <Chip size="small" label={`Jabatan: ${selectedUser.jabatan}`} />
                  )}
                  {selectedUser.unit_kerja && selectedUser.unit_kerja !== '-' && (
                    <Chip size="small" label={`Unit: ${selectedUser.unit_kerja}`} />
                  )}
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Detail Ruangan Terpilih */}
          {selectedRuangan && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Detail Ruangan Terpilih:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip size="small" label={`Kode: ${selectedRuangan.kode_ruangan}`} />
                  <Chip size="small" label={`Nama: ${selectedRuangan.nama_ruangan}`} />
                  {selectedRuangan.lokasi && (
                    <Chip size="small" label={`Lokasi: ${selectedRuangan.lokasi}`} />
                  )}
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Info Created At (untuk edit) */}
          {initialData && formData.created_at && (
            <Grid item xs={12}>
              <Divider />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                ID: {formData.id} · Dibuat pada: {new Date(formData.created_at).toLocaleString('id-ID')}
              </Typography>
            </Grid>
          )}
        </Grid>
      </form>
    </LocalizationProvider>
  );
};

export default PicRuanganForm;