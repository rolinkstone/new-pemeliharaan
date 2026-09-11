import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, Chip, IconButton, Alert,
  CircularProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper,
} from '@mui/material';
import { Cancel as CancelIcon } from '@mui/icons-material';
import axios from 'axios';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_URL = `${BASE}/persediaan`;

const getHeaders = (session) => ({
  Authorization: `Bearer ${session?.accessToken}`,
  'Content-Type': 'application/json',
});

export default function ProsesSerahkanModal({ open, onClose, group, session, onSuccess }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reasonDialog, setReasonDialog] = useState({ open: false, itemId: null });
  const [reasonText, setReasonText] = useState('');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open || !group?.items) { initializedRef.current = false; return; }
    if (initializedRef.current) return; // sudah terisi, skip refetch
    initializedRef.current = true;
    // Fetch all barang to get current stocks
    const init = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_URL}/barang`, {
          headers: getHeaders(session),
          params: { limit: 9999 }
        });
        const allBarang = data.data || [];
        const enriched = group.items.map((item) => {
          const barang = allBarang.find(b => b.id === item.barang_id || String(b.id) === String(item.barang_id));
          const stok = barang?.saldo || 0;
          return {
            ...item,
            stok_tersedia: stok,
            jumlah_serahkan: Math.min(item.jumlah, stok),
            ditolak: false,
            alasan: '',
          };
        });
        setItems(enriched);
      } catch (e) {
        // Fallback: use item.jumlah as default
        setItems(group.items.map(i => ({ ...i, stok_tersedia: 0, jumlah_serahkan: 0, ditolak: false, alasan: '' })));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [open, group, session]);

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const payload = items.map(i => ({
        id: i.id,
        jumlah_serahkan: i.ditolak ? 0 : Number(i.jumlah_serahkan) || 0,
        ditolak: i.ditolak,
        alasan: i.alasan || '',
      }));
      const res = await axios.post(`${API_URL}/permintaan/${group.group_id}/proses-items`,
        { items: payload },
        { headers: getHeaders(session) }
      );
      if (res.data?.success) {
        onSuccess?.(res.data.message);
        onClose();
      } else {
        setError(res.data?.message || 'Gagal');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const anyProcessed = items.some(i => !i.ditolak && Number(i.jumlah_serahkan) > 0);

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        Proses Penyerahan Barang
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
          {group?.tanggal_permintaan ? `Tanggal: ${group.tanggal_permintaan}` : ''} — PIC: {group?.requested_by || '-'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading && !items.length ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.8rem', color: '#64748b' } }}>
                  <TableCell>Barang</TableCell>
                  <TableCell align="center">Diminta</TableCell>
                  <TableCell align="center">Stok</TableCell>
                  <TableCell align="center">Diserahkan</TableCell>
                  <TableCell align="center">Tolak</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover sx={{ bgcolor: item.ditolak ? '#fef2f2' : 'inherit' }}>
                    <TableCell>
                      <Typography fontWeight={500} variant="body2">{item.nama_barang}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.satuan}</Typography>
                    </TableCell>
                    <TableCell align="center"><Typography fontWeight={600}>{item.jumlah}</Typography></TableCell>
                    <TableCell align="center">
                      <Chip label={item.stok_tersedia || 0} size="small"
                        color={(item.stok_tersedia || 0) > 0 ? 'success' : 'error'}
                        sx={{ fontWeight: 600, minWidth: 40 }} />
                    </TableCell>
                    <TableCell align="center">
                      {item.ditolak ? (
                        <Typography variant="body2" color="error">—</Typography>
                      ) : (
                        <TextField
                          type="number"
                          size="small"
                          value={item.jumlah_serahkan}
                          onChange={(e) => {
                            const val = Math.min(Number(e.target.value) || 0, item.jumlah, item.stok_tersedia);
                            updateItem(item.id, 'jumlah_serahkan', val);
                          }}
                          inputProps={{ min: 0, max: Math.min(item.jumlah, item.stok_tersedia), style: { textAlign: 'center', width: 60 } }}
                          sx={{ width: 80 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (item.ditolak) {
                            // Un-tolak — langsung tanpa dialog
                            updateItem(item.id, 'ditolak', false);
                            updateItem(item.id, 'alasan', '');
                          } else {
                            // Tolak — buka dialog alasan dulu
                            setReasonText('');
                            setReasonDialog({ open: true, itemId: item.id });
                          }
                        }}
                        sx={{ color: item.ditolak ? '#ef4444' : '#94a3b8' }}
                      >
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="primary" onClick={handleSubmit}
          disabled={loading || !anyProcessed}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Konfirmasi
        </Button>
      </DialogActions>
    </Dialog>

      {/* Dialog Alasan Tolak */}
      <Dialog open={reasonDialog.open} onClose={() => setReasonDialog({ open: false, itemId: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Alasan Ditolak</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Masukkan alasan mengapa barang ini ditolak:
          </Typography>
          <TextField
            autoFocus
            label="Alasan"
            multiline
            rows={3}
            fullWidth
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Isi alasan penolakan..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setReasonDialog({ open: false, itemId: null });
          }}>Batal</Button>
          <Button onClick={() => {
            const id = reasonDialog.itemId;
            if (id) {
              updateItem(id, 'ditolak', true);
              updateItem(id, 'alasan', reasonText || 'Stok tidak mencukupi');
            }
            setReasonDialog({ open: false, itemId: null });
          }} color="error" variant="contained" disabled={!reasonText.trim()}>
            Tolak
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
