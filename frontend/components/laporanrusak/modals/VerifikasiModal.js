// components/laporanrusak/modals/VerifikasiModal.js
// Cek Fisik BMN oleh PIC Ruangan (alur baru)
// Keputusan: internal (perbaikan tim internal -> selesai)
//            anggaran (perlu anggaran -> diteruskan ke Katim, pilih Katim)
//            tolak

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Chip, Alert, CircularProgress,
  RadioGroup, FormControlLabel, Radio, Autocomplete, InputAdornment,
} from '@mui/material';
import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api').replace(/\/+$/, '');
const getHeaders = (session) => ({
  Authorization: `Bearer ${session?.accessToken}`,
  'Content-Type': 'application/json',
});

export default function VerifikasiModal({ open, onClose, onConfirm, laporan, loading, session }) {
  const [keputusan, setKeputusan] = useState('internal');
  const [catatan, setCatatan] = useState('');
  const [katimId, setKatimId] = useState('');
  const [katimNama, setKatimNama] = useState('');
  const [estimasiBiaya, setEstimasiBiaya] = useState('');
  const [katimList, setKatimList] = useState([]);
  const [katimLoading, setKatimLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKeputusan('internal');
    setCatatan('');
    setKatimId('');
    setKatimNama('');
    setEstimasiBiaya('');
    setError('');
  }, [open]);

  const loadKatim = async () => {
    if (katimList.length > 0) return;
    setKatimLoading(true);
    try {
      let token = session?.accessToken || session?.token;
      if (!token) { try { token = localStorage.getItem('token'); } catch (e) { /* ignore */ } }
      const { data } = await axios.get(`${BASE}/keycloak/katim/list`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      const arr = data?.data || data || [];
      setKatimList(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error('Gagal muat Katim:', e);
    } finally {
      setKatimLoading(false);
    }
  };

  const handleOpenKatim = () => {
    if (keputusan === 'anggaran') loadKatim();
  };

  const handleSubmit = () => {
    setError('');
    if (!catatan.trim() && keputusan !== 'tolak') {
      setError('Detail hasil pengecekan fisik wajib diisi');
      return;
    }
    if (keputusan === 'anggaran' && !katimId) {
      setError('Pilih Katim tujuan terlebih dahulu');
      return;
    }
    setSubmitting(true);
    onConfirm({
      keputusan,
      catatan: catatan.trim(),
      katim_id: keputusan === 'anggaran' ? katimId : null,
      katim_nama: keputusan === 'anggaran' ? katimNama : null,
      estimasi_biaya: keputusan === 'anggaran' && estimasiBiaya ? parseFloat(estimasiBiaya) : null,
    });
    // loading di-handle oleh parent; reset submitting setelah dipanggil
    setTimeout(() => setSubmitting(false), 1000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Cek Fisik BMN</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {laporan && (
            <Box>
              <Typography variant="body2" fontWeight={600}>{laporan.nomor_laporan}</Typography>
              <Typography variant="caption" color="text.secondary">{laporan.aset_nama} — {laporan.ruangan_nama}</Typography>
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Typography variant="subtitle2" fontWeight={600} mb={0.5}>Keputusan Pengecekan Fisik</Typography>
            <RadioGroup row value={keputusan} onChange={(e) => setKeputusan(e.target.value)}>
              <FormControlLabel value="internal" control={<Radio size="small" />} label="Perbaikan Tim Internal" />
              <FormControlLabel value="anggaran" control={<Radio size="small" />} label="Perlu Anggaran" />
              <FormControlLabel value="tolak" control={<Radio size="small" />} label="Tolak" />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary">
              {keputusan === 'internal' ? 'Perbaikan oleh tim internal → laporan langsung selesai.'
                : keputusan === 'anggaran' ? 'Diteruskan ke Katim untuk diteruskan ke PPK.'
                : 'Laporan ditolak pada pengecekan fisik.'}
            </Typography>
          </Box>

          <TextField
            label={keputusan === 'tolak' ? 'Alasan Penolakan' : 'Detail Kerusakan (hasil cek fisik)'}
            multiline rows={3} fullWidth value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Uraikan hasil pengecekan fisik BMN..."
          />

          {keputusan === 'anggaran' && (
            <>
              <Autocomplete
                onOpen={handleOpenKatim}
                options={katimList}
                loading={katimLoading}
                getOptionLabel={(opt) => opt?.nama || opt?.username || opt?.user_id || ''}
                value={katimList.find(k => String(k.user_id || k.id) === String(katimId)) || null}
                onChange={(e, val) => {
                  setKatimId(val ? String(val.user_id || val.id) : '');
                  setKatimNama(val ? (val.nama || val.username || '') : '');
                }}
                isOptionEqualToValue={(opt, val) => String(opt.user_id || opt.id) === String(val?.user_id || val?.id)}
                renderInput={(params) => (
                  <TextField {...params} label="Pilih Katim" required size="small"
                    InputProps={{ ...params.InputProps, endAdornment: katimLoading ? <CircularProgress size={18} /> : params.InputProps.endAdornment }} />
                )}
              />
              <TextField
                label="Estimasi Biaya (opsional)" type="number" fullWidth size="small"
                value={estimasiBiaya}
                onChange={(e) => setEstimasiBiaya(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">Rp</InputAdornment> }}
              />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="primary" onClick={handleSubmit} disabled={submitting || loading}>
          {submitting || loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Simpan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
