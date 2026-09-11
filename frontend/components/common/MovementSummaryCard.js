// components/common/MovementSummaryCard.js
// Kartu ringkasan "Barang/Reagen Tidak Bergerak" di bagian atas halaman Persediaan
// (ATK & Reagen). Menampilkan hitungan: total, ≥ 1 tahun, ≥ 6 bulan, belum pernah.
// Klik kartu / tombol "Lihat Detail" → modal berisi tabel lengkap (MovementMonitor).

import React, { useState } from 'react';
import {
  Card, CardContent, Box, Typography, Button,
  Dialog, DialogTitle, DialogContent, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MovementMonitor, { computeMovementSummary } from './MovementMonitor';

const StatBox = ({ label, value, color, loading }) => (
  <Box sx={{
    flex: '1 1 120px', minWidth: 120, p: 1.5, borderRadius: 2,
    bgcolor: `${color}14`, border: `1px solid ${color}44`,
  }}>
    <Typography variant="h6" sx={{ color, fontWeight: 800, lineHeight: 1.2 }}>
      {loading ? '—' : value}
    </Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
  </Box>
);

export default function MovementSummaryCard({
  rows = [],
  loading = false,
  title = 'Barang Tidak Bergerak',
  emptyText = 'Tidak ada data tanpa pergerakan',
}) {
  const [open, setOpen] = useState(false);
  const summary = computeMovementSummary(rows);

  return (
    <>
      <Card
        variant="outlined"
        onClick={() => setOpen(true)}
        sx={{
          mb: 3, borderRadius: 2, cursor: 'pointer',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #fff 60%)',
          borderColor: '#bae6fd',
          transition: 'all .2s',
          '&:hover': { boxShadow: '0 6px 20px rgba(14,165,233,0.15)', transform: 'translateY(-1px)' },
        }}
      >
        <CardContent sx={{ p: '16px 20px', '&:last-child': { pb: '16px' } }}>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={1.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
              bgcolor: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <InfoOutlinedIcon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0c4a6e' }}>
                {title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Barang tanpa pergerakan masuk/keluar selama periode tertentu — klik untuk detail
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              endIcon={<ListAltIcon fontSize="small" />}
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              sx={{ color: '#0284c7', borderColor: '#7dd3fc', textTransform: 'none' }}
            >
              Lihat Detail
            </Button>
          </Box>

          <Box display="flex" gap={1.5} flexWrap="wrap">
            <StatBox label="Total Barang" value={summary.total} color="#0284c7" loading={loading} />
            <StatBox label="≥ 1 Tahun" value={summary.over365} color="#dc2626" loading={loading} />
            <StatBox label="≥ 6 Bulan" value={summary.over180} color="#d97706" loading={loading} />
            <StatBox label="Belum Pernah" value={summary.never} color="#7c3aed" loading={loading} />
          </Box>
        </CardContent>
      </Card>

      {/* Modal detail lengkap */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <InfoOutlinedIcon sx={{ color: '#0284c7' }} />
            <Typography variant="h6" fontWeight={700}>{title} — Detail</Typography>
          </Box>
        </DialogTitle>
        <IconButton
          onClick={() => setOpen(false)}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent dividers>
          <MovementMonitor rows={rows} loading={loading} emptyText={emptyText} />
        </DialogContent>
      </Dialog>
    </>
  );
}
