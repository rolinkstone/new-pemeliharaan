import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import {
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  MeetingRoom as RoomIcon,
  Cancel as CancelIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

/**
 * PolishedPageShell — Membungkus halaman dengan header premium dan stat cards yang menarik.
 *
 * Props:
 *  - title: string (judul halaman)
 *  - subtitle: string (deskripsi)
 *  - actions: ReactNode (tombol2 aksi di pojok kanan header)
 *  - children: konten utama (filter, table, dll)
 *  - statistics: array of { label, value, color, icon }
 *  - roleBadge: ReactNode (opsional)
 */
export default function PolishedPageShell({
  title,
  subtitle,
  actions,
  children,
  statistics,
  roleBadge,
}) {
  const theme = useTheme();

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      {/* ===== HEADER ===== */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.primary.light} 100%)`,
          p: { xs: 3, md: 4 },
        }}
      >
        {/* Decorative circles */}
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -60,
            left: '30%',
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 700,
                color: '#fff',
                fontSize: { xs: '1.25rem', md: '1.5rem' },
                lineHeight: 1.3,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  mt: 0.5,
                  fontSize: { xs: '0.8rem', md: '0.875rem' },
                }}
              >
                {subtitle}
              </Typography>
            )}
            {roleBadge && (
              <Box sx={{ mt: 1.5 }}>{roleBadge}</Box>
            )}
          </Box>
          {actions && (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                '& .MuiButton-root': {
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  px: 2,
                  py: 1,
                  minHeight: 40,
                },
                '& .MuiButton-contained': {
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                  },
                },
                '& .MuiButton-outlined': {
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.6)',
                    background: 'rgba(255,255,255,0.08)',
                  },
                },
              }}
            >
              {actions}
            </Box>
          )}
        </Box>
      </Box>

      {/* ===== STATISTICS CARDS ===== */}
      {statistics && statistics.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: `repeat(${Math.min(statistics.length, 4)}, 1fr)`,
            },
            gap: 2,
            mb: 3,
          }}
        >
          {statistics.map((stat, i) => {
            const gradientMap = {
              primary: 'from-blue-500 to-indigo-600',
              success: 'from-emerald-500 to-teal-600',
              warning: 'from-amber-500 to-orange-600',
              error: 'from-rose-500 to-red-600',
              info: 'from-cyan-500 to-blue-600',
            };

            return (
              <Box
                key={i}
                className="stat-card"
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: alpha(stat.color || theme.palette.primary.main, 0.15),
                  p: 2.5,
                  transition: 'all 0.2s ease',
                  cursor: 'default',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: `0 8px 25px ${alpha(stat.color || theme.palette.primary.main, 0.2)}`,
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${stat.color || theme.palette.primary.main}, ${alpha(stat.color || theme.palette.primary.main, 0.5)})`,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {stat.label}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 700,
                        color: 'text.primary',
                        mt: 0.5,
                        fontSize: { xs: '1.5rem', md: '1.75rem' },
                      }}
                    >
                      {(stat.value ?? 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${alpha(stat.color || theme.palette.primary.main, 0.12)}, ${alpha(stat.color || theme.palette.primary.main, 0.06)})`,
                      color: stat.color || theme.palette.primary.main,
                      flexShrink: 0,
                      ml: 1,
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
                {/* subtle progress bar */}
                <Box
                  sx={{
                    mt: 2,
                    height: 2.5,
                    borderRadius: 2,
                    background: alpha(stat.color || theme.palette.primary.main, 0.1),
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${Math.min(100, Math.max(10, ((stat.value ?? 0) / (stat.maxValue || 100)) * 100))}%`,
                      height: '100%',
                      borderRadius: 2,
                      background: `linear-gradient(90deg, ${stat.color || theme.palette.primary.main}, ${alpha(stat.color || theme.palette.primary.main, 0.5)})`,
                      transition: 'width 0.8s ease',
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ===== MAIN CONTENT ===== */}
      {children}
    </Box>
  );
}

export const statIcon = {
  Inventory: <InventoryIcon sx={{ fontSize: 22 }} />,
  CheckCircle: <CheckCircleIcon sx={{ fontSize: 22 }} />,
  Warning: <WarningIcon sx={{ fontSize: 22 }} />,
  Error: <ErrorIcon sx={{ fontSize: 22 }} />,
  Room: <RoomIcon sx={{ fontSize: 22 }} />,
  Cancel: <CancelIcon sx={{ fontSize: 22 }} />,
  Group: <GroupIcon sx={{ fontSize: 22 }} />,
  Person: <PersonIcon sx={{ fontSize: 22 }} />,
  Timeline: <TimelineIcon sx={{ fontSize: 22 }} />,
};
