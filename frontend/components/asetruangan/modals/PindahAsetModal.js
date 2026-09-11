import React, { useState, useEffect } from 'react';
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
  Autocomplete,
  Chip,
  InputAdornment,
} from '@mui/material';
import { Close as CloseIcon, SwapHoriz as SwapIcon } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Search as SearchIcon } from '@mui/icons-material';
import idLocale from 'date-fns/locale/id';
import * as asetRuanganApi from '../api/asetRuanganApi';
import { useSession } from 'next-auth/react';

const PindahAsetModal = ({
  open,
  onClose,
  onConfirm,
  asetInfo,
  ruanganInfo,
  loading = false,
}) => {
  const { data: session } = useSession();
  const [formData, setFormData] = useState({
    tgl_pindah: new Date().toISOString(),
    ruangan_baru_id: '',
    keterangan: '',
  });
  const [errors, setErrors] = useState({});
  const [ruanganOptions, setRuanganOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Load ruangan options
  useEffect(() => {
    if (!session || !open) return;
    
    const loadRuangan = async () => {
      setLoadingOptions(true);
      try {
        const result = await asetRuanganApi.fetchRuanganOptions(session);
        if (result?.success) {
          // Filter out current room
          const filtered = (result.data || []).filter(r => r.id !== ruanganInfo?.id);
          setRuanganOptions(filtered);
        }
      } catch (error) {
        console.error('Error loading ruangan:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadRuangan();
  }, [session, open, ruanganInfo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, tgl_pindah: date ? date.toISOString() : null }));
    if (errors.tgl_pindah) {
      setErrors(prev => ({ ...prev, tgl_pindah: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.tgl_pindah) {
      newErrors.tgl_pindah = 'Tanggal pindah harus diisi';
    }
    if (!formData.ruangan_baru_id) {
      newErrors.ruangan_baru_id = 'Ruangan tujuan harus dipilih';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      console.log('📤 Mengirim data pindah:', formData);
      onConfirm(formData);
    }
  };

  // Filter ruangan options based on search
  const filteredRuangan = ruanganOptions.filter(ruangan => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      ruangan.kode_ruangan?.toLowerCase().includes(searchLower) ||
      ruangan.nama_ruangan?.toLowerCase().includes(searchLower) ||
      ruangan.lokasi?.toLowerCase().includes(searchLower)
    );
  });

  const selectedRuanganBaru = ruanganOptions.find(r => r.id === formData.ruangan_baru_id);

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
        <DialogTitle sx={{ bgcolor: 'info.main', color: 'white' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <SwapIcon />
              <Typography variant="h6">Pindah Aset ke Ruangan Lain</Typography>
            </Box>
            <IconButton onClick={onClose} sx={{ color: 'white' }} disabled={loading}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          {/* Info Aset dan Ruangan Asal */}
          {asetInfo && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Aset:</strong> {asetInfo.nama_barang} ({asetInfo.kode_barang})
              </Typography>
              <Typography variant="body2">
                <strong>Ruangan Asal:</strong> {ruanganInfo?.nama_ruangan} ({ruanganInfo?.kode_ruangan})
              </Typography>
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            {/* Tanggal Pindah */}
            <DateTimePicker
              label="Tanggal Pindah *"
              value={formData.tgl_pindah ? new Date(formData.tgl_pindah) : null}
              onChange={handleDateChange}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: !!errors.tgl_pindah,
                  helperText: errors.tgl_pindah,
                  sx: { mb: 2 }
                }
              }}
            />

            {/* Pilih Ruangan Tujuan */}
            <Autocomplete
              options={filteredRuangan}
              loading={loadingOptions}
              getOptionLabel={(option) => {
                if (!option) return '';
                return `${option.kode_ruangan} - ${option.nama_ruangan}`;
              }}
              value={selectedRuanganBaru || null}
              onChange={(event, newValue) => {
                setFormData(prev => ({ ...prev, ruangan_baru_id: newValue?.id || '' }));
                if (errors.ruangan_baru_id) {
                  setErrors(prev => ({ ...prev, ruangan_baru_id: '' }));
                }
              }}
              onInputChange={(event, newInputValue) => {
                setSearchText(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Pilih Ruangan Tujuan *"
                  error={!!errors.ruangan_baru_id}
                  helperText={errors.ruangan_baru_id || 'Ketik untuk mencari ruangan'}
                  fullWidth
                  sx={{ mb: 2 }}
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
              noOptionsText="Tidak ada ruangan yang ditemukan"
              isOptionEqualToValue={(option, value) => option.id === value?.id}
            />

            {/* Keterangan */}
            <TextField
              fullWidth
              label="Keterangan"
              name="keterangan"
              value={formData.keterangan}
              onChange={handleChange}
              multiline
              rows={3}
              placeholder="Masukkan alasan atau keterangan pemindahan"
              sx={{ mt: 2 }}
            />

            {/* Info Ruangan Terpilih */}
            {selectedRuanganBaru && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="success" icon={<SwapIcon />}>
                  <Typography variant="body2">
                    <strong>Ruangan Tujuan:</strong> {selectedRuanganBaru.nama_ruangan}
                  </Typography>
                  <Typography variant="caption">
                    Kode: {selectedRuanganBaru.kode_ruangan} | Lokasi: {selectedRuanganBaru.lokasi || '-'}
                  </Typography>
                </Alert>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Button onClick={onClose} variant="outlined" disabled={loading}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="info"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Memindahkan...' : 'Pindahkan Aset'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default PindahAsetModal;