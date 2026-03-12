// utils/makParser.js
export const parseMAK = (mak) => {
    if (!mak) return null;
    
    const parts = mak.split('.');
    if (parts.length !== 6) return null;
    
    return {
        kodeUnit: parts[0],          // Kode unit organisasi (4 digit)
        kodeProgram: parts[1],        // Kode program (3 digit)
        kodeKegiatan: parts[2],       // Kode kegiatan (3 digit)
        kodeOutput: parts[3],         // Kode output (3 digit)
        kodeAkun: parts[4],           // Kode akun (6 digit)
        kodeDetail: parts[5]          // Kode detail (1 digit)
    };
};

export const getMAKComponents = (mak) => {
    const parsed = parseMAK(mak);
    if (!parsed) return null;
    
    return {
        tahunAnggaran: new Date().getFullYear(),
        kodeSatker: parsed.kodeUnit,
        kodeProgram: parsed.kodeProgram,
        kodeKegiatan: parsed.kodeKegiatan,
        kodeOutput: parsed.kodeOutput,
        kodeAkun: parsed.kodeAkun,
        kodeDetail: parsed.kodeDetail
    };
};