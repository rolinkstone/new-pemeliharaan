// components/pencatatan/modals/PencatatanSelesaiModal.js
// Menandai bahwa tindak lanjut sudah selesai (sudah diinput keuangan / sudah dicatat keluar)

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Box, Typography, CircularProgress, MenuItem,
} from '@mui/material';

export default function PencatatanSelesaiModal({ open, onClose, onConfirm, item, loading }) {
  const [keterangan, setKeterangan] = useState('');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (!open) return;
    setKeterangan(item?.tipe === 'diterima' ? 'Sudah diinput keuangan' : 'Sudah dicatat sebagai barang keluar');
    setCatatan('');
  }, [open, item]);

  const handleSubmit = () => {
    onConfirm({ status_catatan: `${keterangan}${catatan ? ': ' + catatan : ''}` });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Tandai Selesai / Sudah Diproses</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {item && (
            <Typography variant="body2">
              <b>{item.nama_barang}</b> — {item.jumlah} {item.satuan}
            </Typography>
          )}
          <TextField select label="Keterangan Tindak Lanjut" fullWidth value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}>
            <MenuItem value="Sudah diinput keuangan">Sudah diinput keuangan</MenuItem>
            <MenuItem value="Sudah dicatat sebagai barang keluar">Sudah dicatat sebagai barang keluar</MenuItem>
            <MenuItem value="Lainnya">Lainnya</MenuItem>
          </TextField>
          <TextField label="Catatan (opsional)" multiline rows={2} fullWidth value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Detail tindak lanjut / nomor dokumen..." />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" color="success" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Tandai Selesai
        </Button>
      </DialogActions>
    </Dialog>
  );
}
