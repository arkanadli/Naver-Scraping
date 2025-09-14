import Bottleneck from 'bottleneck';

// Konfigurasi untuk throttling dan random delay 
export const limiter = new Bottleneck({
  maxConcurrent: 5, // Maksimal 5 request berjalan bersamaan
  minTime: 250,     // Jeda minimal 250ms antar request
});