import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Alert, CircularProgress, List, ListItem, ListItemText, Chip, Paper,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import * as api from '../api/ruanganApi';

const ImportRuanganModal = ({ open, onClose, session, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => { setFile(null); setResult(null); };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await api.importRuanganXLSX(session, file);
      setResult({
        ok: res?.success,
        message: res?.message || 'Import selesai',
        success: res?.data?.success ?? 0,
        failed: res?.data?.failed ?? 0,
        errors: res?.data?.errors || [],
      });
      if (res?.success) {
        onSuccess?.(res.message, res.data);
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Gagal import file';
      setResult({ ok: false, message: msg, success: 0, failed: 1, errors: [msg] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        Import Data Ruangan (XLSX)
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
          Tambah data ruangan secara massal dari file Excel. Gunakan template untuk format yang benar.
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Template */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 2, p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}
        >
          <Box>
            <Typography variant="body2" fontWeight={600}>Template Import Ruangan</Typography>
            <Typography variant="caption" color="text.secondary">
              Kode Ruangan · Nama Ruangan · Deskripsi · Lokasi · Status
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => window.open(api.downloadImportTemplateUrl, '_blank')}
          >
            Download
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Kode ruangan yang <b>sudah ada</b> atau duplikat di dalam file akan
          <b> dilewati</b> dan dicatat sebagai gagal.
        </Alert>

        {/* File picker */}
        <Button
          component="label"
          variant="outlined"
          fullWidth
          disabled={importing}
          sx={{ py: 3, borderStyle: 'dashed', flexDirection: 'column', gap: 1 }}
        >
          <CloudUploadIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-all' }}>
            {file ? file.name : 'Pilih file XLSX / XLS'}
          </Typography>
          {!file && (
            <Typography variant="caption" color="text.secondary">Klik untuk memilih file</Typography>
          )}
          <input
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }}
          />
        </Button>

        {/* Result */}
        {result && (
          <Box mt={2}>
            <Alert severity={result.ok ? (result.failed > 0 ? 'warning' : 'success') : 'error'} sx={{ mb: 1 }}>
              {result.message}
            </Alert>
            {result.ok && (
              <Box display="flex" gap={1} sx={{ mb: 1 }}>
                <Chip size="small" color="success" label={`Berhasil: ${result.success}`} />
                <Chip size="small" color="error" label={`Gagal: ${result.failed}`} />
              </Box>
            )}
            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                <List dense disablePadding>
                  {result.errors.map((err, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                      <ListItemText
                        primary={<Typography variant="caption" color="error">{err}</Typography>}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>Tutup</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={!file || importing}
          startIcon={importing ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
        >
          {importing ? 'Mengimport...' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportRuanganModal;
