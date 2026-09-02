// components/laporanrusak/modals/KatimKirimModal.js
// Katim mengetahui laporan kerusakan & mengirim ke PPK (pilih PPK)

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Alert, CircularProgress, Autocomplete,
} from '@mui/material';
import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api').replace(/\/+$/, '');

export default function KatimKirimModal({ open, onClose, onConfirm, laporan, loading, session }) {
  const [ppkId, setPpkId] = useState('');
  const [ppkNama, setPpkNama] = useState('');
  const [catatan, setCatatan] = useState('');
  const [ppkList, setPpkList] = useState([]);
  const [ppkLoading, setPpkLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPpkId('');
    setPpkNama('');
    setCatatan('');
    setError('');
  }, [open]);

  const loadPPK = async () => {
    if (ppkList.length > 0) return;
    setPpkLoading(true);
    try {
      let token = session?.accessToken || session?.token;
      if (!token) { try { token = localStorage.getItem('token'); } catch (e) { /* ignore */ } }
      const { data } = await axios.get(`${BASE}/keycloak/ppk/list`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      const arr = data?.data || data?.users || data || [];
      setPpkList(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error('Gagal muat daftar PPK:', e);
    } finally {
      setPpkLoading(false);
    }
  };

  const handleSubmit = () => {
    setError('');
    if (!ppkId) {
      setError('PPK tujuan wajib dipilih');
      return;
    }
    onConfirm({ ppk_id: ppkId, ppk_nama: ppkNama, catatan: catatan.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Katim — Kirim ke PPK</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {laporan && (
            <Box>
              <Typography variant="body2" fontWeight={600}>{laporan.nomor_laporan}</Typography>
              <Typography variant="caption" color="text.secondary">{laporan.aset_nama} — {laporan.ruangan_nama}</Typography>
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Autocomplete
            onOpen={loadPPK}
            options={ppkList}
            loading={ppkLoading}
            getOptionLabel={(opt) => opt?.nama || opt?.username || opt?.email || ''}
            value={ppkList.find(k => String(k.user_id || k.id) === String(ppkId)) || null}
            onChange={(e, val) => {
              setPpkId(val ? String(val.user_id || val.id) : '');
              setPpkNama(val ? (val.nama || val.username || '') : '');
            }}
            isOptionEqualToValue={(opt, val) => String(opt.user_id || opt.id) === String(val?.user_id || val?.id)}
            renderInput={(params) => (
              <TextField {...params} label="Pilih PPK Tujuan" required size="small"
                InputProps={{ ...params.InputProps, endAdornment: ppkLoading ? <CircularProgress size={18} /> : params.InputProps.endAdornment }} />
            )}
          />
          <TextField
            label="Catatan" multiline rows={3} fullWidth value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan Katim untuk PPK..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Kirim ke PPK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
