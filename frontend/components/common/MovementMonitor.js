// components/common/MovementMonitor.js
// Pemantauan barang/reagen yang tidak mengalami pergerakan masuk/keluar dalam
// jangka waktu tertentu (mis. 6 bulan / 1 tahun). Komponen reusable untuk
// Persediaan ATK & Reagen — data harus berupa array hasil endpoint /movement
// dengan field: id, nama_barang, kode_barang?, jenis?, kategori, satuan, stok,
// last_masuk, last_keluar, last_movement, hari_tidak_bergerak, pernah_bergerak.

import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, TextField, MenuItem,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { formatDateForDisplay } from '../../utils/formatters';

const PERIODS = [
  { value: 0, label: 'Semua Barang' },
  { value: 30, label: '≥ 1 bulan (30 hari)' },
  { value: 90, label: '≥ 3 bulan (90 hari)' },
  { value: 180, label: '≥ 6 bulan (180 hari)' },
  { value: 365, label: '≥ 1 tahun (365 hari)' },
  { value: 730, label: '≥ 2 tahun (730 hari)' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Format tanggal 'YYYY-MM-DD' secara deterministik (hindari efek timezone)
const fmtDate = (s) => {
  if (!s) return '-';
  const p = String(s).split('-');
  if (p.length !== 3 || p.some(x => isNaN(Number(x)))) return formatDateForDisplay(s);
  const m = MONTHS[Number(p[1]) - 1];
  if (!m) return formatDateForDisplay(s);
  return `${Number(p[2])} ${m} ${p[0]}`;
};

// Warna chip berdasarkan lama tidak bergerak
const idleChip = (days) => {
  if (days === null) return { label: 'Belum pernah', color: 'secondary' };
  if (days >= 365) return { label: `${days} hari`, color: 'error' };
  if (days >= 180) return { label: `${days} hari`, color: 'warning' };
  if (days >= 90) return { label: `${days} hari`, color: 'info' };
  return { label: `${days} hari`, color: 'default' };
};

const subtitleOf = (b) => {
  const kode = b.kode_barang ? b.kode_barang : '';
  const extra = b.jenis ? b.jenis : '';
  const cat = b.kategori ? b.kategori : '';
  return [kode, extra, cat].filter(Boolean).join(' · ');
};

// Ringkasan cepat (dipakai kartu ringkasan di atas halaman)
export const computeMovementSummary = (rows = []) => {
  const never = rows.filter(r => !r.pernah_bergerak).length;
  const over365 = rows.filter(r => r.pernah_bergerak && (r.hari_tidak_bergerak ?? Infinity) >= 365).length;
  const over180 = rows.filter(r => r.pernah_bergerak && (r.hari_tidak_bergerak ?? Infinity) >= 180).length;
  return { total: rows.length, never, over365, over180 };
};

export default function MovementMonitor({ rows = [], loading = false, emptyText = 'Tidak ada data', initialPeriod = 0 }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);

  const summary = useMemo(() => computeMovementSummary(rows), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    // Filter jangka waktu: barang yang TIDAK pernah bergerak selalu memenuhi
    if (period > 0) {
      list = list.filter(r => !r.pernah_bergerak || (r.hari_tidak_bergerak ?? Infinity) >= period);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        String(r.nama_barang || '').toLowerCase().includes(q) ||
        String(r.kode_barang || '').toLowerCase().includes(q) ||
        String(r.jenis || '').toLowerCase().includes(q) ||
        String(r.kategori || '').toLowerCase().includes(q)
      );
    }
    // Urutkan: barang yang tidak pernah bergerak dahulu, lalu paling lama tidak bergerak
    list = [...list].sort((a, b) => {
      const da = a.pernah_bergerak ? (a.hari_tidak_bergerak ?? 0) : Infinity;
      const db = b.pernah_bergerak ? (b.hari_tidak_bergerak ?? 0) : Infinity;
      return db - da;
    });
    return list;
  }, [rows, period, search]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / perPage) - 1));
  const paged = filtered.slice(safePage * perPage, safePage * perPage + perPage);

  return (
    <Box>
      {/* Filter bar */}
      <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Cari nama / kode barang..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 240 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            }}
          />
          <TextField
            select
            size="small"
            label="Min. Lama Tidak Bergerak"
            value={period}
            onChange={(e) => { setPeriod(Number(e.target.value)); setPage(0); }}
            sx={{ minWidth: 240 }}
          >
            {PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
            <Chip label={`Total: ${summary.total}`} size="small" variant="outlined" />
            <Chip label={`${summary.over365} ≥ 1 tahun`} size="small" color="error" variant="outlined" />
            <Chip label={`${summary.over180} ≥ 6 bulan`} size="small" color="warning" variant="outlined" />
            <Chip label={`${summary.never} belum pernah`} size="small" color="secondary" variant="outlined" />
          </Box>
        </Box>
      </Paper>

      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Menampilkan <b>{filtered.length}</b> barang yang tidak mengalami pergerakan masuk/keluar
        {period > 0 ? ` selama ${PERIODS.find(p => p.value === period)?.label.replace('Semua Barang', '') || ''}` : ''}.
      </Typography>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc', '& th': { fontWeight: 600, fontSize: '0.78rem', color: '#64748b' } }}>
              <TableCell>Barang</TableCell>
              <TableCell align="right">Stok</TableCell>
              <TableCell>Terakhir Masuk</TableCell>
              <TableCell>Terakhir Keluar</TableCell>
              <TableCell>Terakhir Bergerak</TableCell>
              <TableCell align="right">Lama Tidak Bergerak</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94a3b8' }}>Memuat data...</TableCell></TableRow>
            )}
            {!loading && paged.map((b) => {
              const chip = idleChip(b.pernah_bergerak ? b.hari_tidak_bergerak : null);
              return (
                <TableRow key={b.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>
                    <Typography fontWeight={500} variant="body2">{b.nama_barang}</Typography>
                    <Typography variant="caption" color="text.secondary">{subtitleOf(b)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={b.stok} size="small" sx={{ fontWeight: 700, minWidth: 50 }}
                      color={b.stok > 0 ? 'success' : b.stok === 0 ? 'default' : 'error'} />
                  </TableCell>
                  <TableCell>{fmtDate(b.last_masuk)}</TableCell>
                  <TableCell>{fmtDate(b.last_keluar)}</TableCell>
                  <TableCell>
                    {b.last_movement
                      ? fmtDate(b.last_movement)
                      : <Typography variant="caption" color="text.secondary">Belum pernah</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={chip.label} size="small" color={chip.color} variant="outlined" sx={{ fontWeight: 600 }} />
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && paged.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#94a3b8' }}>{emptyText}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filtered.length}
          page={safePage}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={perPage}
          onRowsPerPageChange={(e) => { setPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Baris/hal"
        />
      </TableContainer>
    </Box>
  );
}
