// components/picruangan/PicRuanganForm.js

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
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Search as SearchIcon, Person as PersonIcon, Warning as WarningIcon } from '@mui/icons-material';
import idLocale from 'date-fns/locale/id';
import PicRuangan from './models/PicRuangan';
import * as picRuanganApi from './api/picRuanganApi';
import { useSession } from 'next-auth/react';

const PicRuanganForm = ({
  initialData,
  onSubmit,
  loading = false,
  readOnly = false,
}) => {
  const { data: session } = useSession();
  
  const [formData, setFormData] = useState({
    id: null,
    user_id: '',
    user_name: '',
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
  const [loadError, setLoadError] = useState(null);

  // Load options from API
  useEffect(() => {
    if (!session) return;
    
    const loadOptions = async () => {
      setLoadingOptions(true);
      setLoadError(null);
      
      try {
        console.log('🔄 Loading user options with role=pic_ruangan...');
        
        const [userResult, ruanganResult] = await Promise.all([
          picRuanganApi.fetchUserOptions(session, 'pic_ruangan'),
          picRuanganApi.fetchRuanganOptions(session)
        ]);

        console.log('📥 User options response:', userResult);
        console.log('📥 Ruangan options response:', ruanganResult);

        if (userResult?.success && userResult.data?.length > 0) {
          const users = userResult.data;
          console.log(`✅ Loaded ${users.length} users with role pic_ruangan`);
          
          users.forEach((user, idx) => {
            console.log(`   ${idx + 1}. ${user.nama} (${user.username}) - NIP: ${user.nip || '-'}`);
          });
          
          setUserOptions(users);
        } else {
          console.error('Failed to load user options:', userResult?.message);
          setLoadError(userResult?.message || 'Tidak ada user dengan role pic_ruangan');
          setUserOptions([]);
        }

        if (ruanganResult?.success && ruanganResult.data) {
          console.log(`✅ Loaded ${ruanganResult.data.length} ruangan options`);
          setRuanganOptions(ruanganResult.data);
        } else {
          console.error('Failed to load ruangan options:', ruanganResult?.message);
        }
      } catch (error) {
        console.error('Error loading options:', error);
        setLoadError(error?.message || 'Terjadi kesalahan saat memuat data');
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
      setFormData({
        id: initialData.id || null,
        user_id: initialData.user_id || '',
        user_name: initialData.user_name || initialData.user_nama || '',
        ruangan_id: initialData.ruangan_id || '',
        tgl_penugasan: initialData.tgl_penugasan || new Date().toISOString().split('T')[0],
        tgl_berakhir: initialData.tgl_berakhir || null,
        status: initialData.status || 'aktif',
      });
      
      if (initialData.user_name || initialData.user_nama) {
        setUserSearchText(initialData.user_name || initialData.user_nama);
      }
    }
  }, [initialData]);

  // Filter user options based on search text
  const filteredUserOptions = useMemo(() => {
    if (!userSearchText || userSearchText.length < 2) {
      return userOptions.slice(0, 50);
    }
    
    const searchLower = userSearchText.toLowerCase();
    return userOptions.filter(user => {
      return (
        (user.nama && user.nama.toLowerCase().includes(searchLower)) ||
        (user.nip && user.nip.toLowerCase().includes(searchLower)) ||
        (user.username && user.username.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower))
      );
    }).slice(0, 100);
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
    if (readOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (name, date) => {
    if (readOnly) return;
    const value = date ? date.toISOString().split('T')[0] : null;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.user_id) {
      newErrors.user_id = 'PIC harus dipilih';
    }
    if (!formData.user_name) {
      newErrors.user_name = 'Nama PIC harus diisi';
    }
    if (!formData.ruangan_id) {
      newErrors.ruangan_id = 'Ruangan harus dipilih';
    }
    if (!formData.tgl_penugasan) {
      newErrors.tgl_penugasan = 'Tanggal penugasan harus diisi';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    if (readOnly) return;
    e.preventDefault();
    if (validate()) {
      const formattedData = {
        user_id: formData.user_id,
        user_name: formData.user_name,
        ruangan_id: formData.ruangan_id,
        tgl_penugasan: formData.tgl_penugasan,
        tgl_berakhir: formData.tgl_berakhir || null,
        status: formData.status
      };
      console.log('📤 Submitting formatted data:', formattedData);
      onSubmit(formattedData);
    }
  };

  const selectedUser = userOptions.find(u => u.user_id === formData.user_id);

  // Handle user selection - set both user_id and user_name
  const handleUserChange = (event, newValue) => {
    if (readOnly) return;
    setFormData(prev => ({ 
      ...prev, 
      user_id: newValue?.user_id || '',
      user_name: newValue?.nama || ''  // Set nama PIC
    }));
    if (errors.user_id) {
      setErrors(prev => ({ ...prev, user_id: '' }));
    }
    if (errors.user_name) {
      setErrors(prev => ({ ...prev, user_name: '' }));
    }
  };

  const selectedRuangan = ruanganOptions.find(r => r.id === formData.ruangan_id);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={idLocale}>
      <form id="pic-ruangan-form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Error Alert */}
          {loadError && (
            <Grid item xs={12}>
              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="body2">{loadError}</Typography>
              </Alert>
            </Grid>
          )}

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
              onChange={handleUserChange}
              onInputChange={(event, newInputValue) => {
                if (readOnly) return;
                setUserSearchText(newInputValue);
              }}
              inputValue={userSearchText}
              disabled={loading || readOnly}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih PIC *"
                  required
                  error={!!errors.user_id}
                  helperText={errors.user_id || 'Cari berdasarkan nama, NIP, atau email (min. 2 karakter)'}
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
                          Username: {option.username}
                        </Typography>
                        {option.jabatan && option.jabatan !== '-' && (
                          <Typography variant="caption" color="textSecondary">
                            Jabatan: {option.jabatan}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </li>
              )}
              noOptionsText={
                loadingOptions 
                  ? 'Memuat data user...'
                  : userSearchText.length < 2 
                    ? 'Ketik minimal 2 karakter untuk mencari' 
                    : userOptions.length === 0 && !loadingOptions
                      ? 'Tidak ada user dengan role pic_ruangan. Periksa konfigurasi Keycloak.'
                      : 'Tidak ada user ditemukan'
              }
              loadingText="Memuat data user..."
              isOptionEqualToValue={(option, value) => option.user_id === value?.user_id}
              filterOptions={(x) => x}
            />
            {/* Hidden field untuk user_name (akan terisi otomatis dari selection) */}
            {formData.user_name && (
              <input type="hidden" name="user_name" value={formData.user_name} />
            )}
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
                if (readOnly) return;
                setFormData(prev => ({ ...prev, ruangan_id: newValue?.id || '' }));
                if (errors.ruangan_id) {
                  setErrors(prev => ({ ...prev, ruangan_id: '' }));
                }
              }}
              onInputChange={(event, newInputValue) => {
                if (readOnly) return;
                setRuanganSearchText(newInputValue);
              }}
              inputValue={ruanganSearchText}
              disabled={loading || readOnly}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih Ruangan *"
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
                loadingOptions
                  ? 'Memuat data ruangan...'
                  : ruanganSearchText.length < 2
                    ? 'Ketik minimal 2 karakter untuk mencari'
                    : 'Tidak ada ruangan ditemukan'
              }
              loadingText="Memuat data ruangan..."
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              filterOptions={(x) => x}
            />
          </Grid>

          {/* Tanggal Penugasan */}
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Tanggal Penugasan *"
              value={formData.tgl_penugasan ? new Date(formData.tgl_penugasan) : null}
              onChange={(date) => handleDateChange('tgl_penugasan', date)}
              disabled={loading || readOnly}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: !!errors.tgl_penugasan,
                  helperText: errors.tgl_penugasan,
                  disabled: loading || readOnly
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
              disabled={loading || readOnly}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.tgl_berakhir,
                  helperText: errors.tgl_berakhir || 'Kosongkan jika masih berlaku',
                  disabled: loading || readOnly
                }
              }}
            />
          </Grid>

          {/* Status */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={loading || readOnly}>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={formData.status}
                onChange={handleChange}
                label="Status"
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
                  {selectedUser.username && (
                    <Chip size="small" label={`Username: ${selectedUser.username}`} />
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
        </Grid>
      </form>
    </LocalizationProvider>
  );
};

export default PicRuanganForm;