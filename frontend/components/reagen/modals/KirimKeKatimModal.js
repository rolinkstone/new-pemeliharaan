import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, InputLabel, Select, MenuItem, TextField,
  CircularProgress, Alert, Box, Typography
} from '@mui/material';
import axios from 'axios';
import * as reagenApi from '../api/reagenApi';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api').replace(/\/+$/, '');

export default function KirimKeKatimModal({ open, onClose, groupId, itemCount, session, onSuccess }) {
  const [katimList, setKatimList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedKatim, setSelectedKatim] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const fetchKatim = async () => {
      setLoadingList(true);
      setError('');
      try {
        const res = await axios.get(`${API_BASE}/keycloak/katim/list`, {
          headers: { Authorization: `Bearer ${session?.accessToken}` }
        });
        if (res.data?.success) setKatimList(res.data.data || []);
        else setKatimList([]);
      } catch (e) {
        setKatimList([]);
      } finally {
        setLoadingList(false);
      }
    };
    fetchKatim();
    setSelectedKatim('');
  }, [open, session]);

  const handleSubmit = async () => {
    if (!selectedKatim) { setError('Pilih Katim terlebih dahulu'); return; }
    const katim = katimList.find(k => k.id === selectedKatim || k.user_id === selectedKatim);
    setLoading(true);
    setError('');
    try {
      const res = await reagenApi.kirimKeKatim(session, groupId, {
        katim_id: selectedKatim,
        katim_nama: katim?.nama || '',
      });
      if (res?.success) {
        onSuccess?.(res.message);
        onClose();
      } else {
        setError(res?.message || 'Gagal');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        Kirim Pengeluaran ke Katim
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
          {itemCount || 1} item akan dikirim untuk disetujui Katim
        </Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loadingList ? (
          <Box display="flex" alignItems="center" gap={2} py={2}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">Memuat daftar Katim...</Typography>
          </Box>
        ) : katimList.length === 0 ? (
          <Alert severity="warning">
            Tidak ada user dengan role Katim ditemukan. Pastikan sudah ada user dengan role "katim" di Keycloak.
          </Alert>
        ) : (
          <FormControl fullWidth>
            <InputLabel>Pilih Katim</InputLabel>
            <Select value={selectedKatim} label="Pilih Katim" onChange={(e) => setSelectedKatim(e.target.value)}>
              {katimList.map((k) => (
                <MenuItem key={k.id || k.user_id} value={k.id || k.user_id}>
                  {k.nama} {k.nip ? `- ${k.nip}` : ''} {k.jabatan ? `(${k.jabatan})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" onClick={handleSubmit}
          disabled={loading || !selectedKatim || loadingList}>
          {loading ? 'Mengirim...' : 'Kirim ke Katim'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
