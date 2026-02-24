import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'abbreviateNumber',
  standalone: true
})
export class AbbreviateNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {

    if (value === null || value === undefined || value === 0 || value === '0') {
      return '0';
    }
    
    const num = Number(value);
    if (isNaN(num)) return '0';
    
    if (Math.abs(num) < 1000) {
      return num.toString();
    }

    const suffixes = ['', 'k', 'M', 'B', 'T', 'Q'];
    const tier = Math.floor(Math.log10(Math.abs(num)) / 3);

    if (tier === 0) return num.toString();
    const sIndex = Math.min(tier, suffixes.length - 1);
    
    const suffix = suffixes[sIndex];
    const scale = Math.pow(10, sIndex * 3);

    const scaled = num / scale;

    return scaled.toFixed(scaled >= 10 ? 0 : 1).replace(/\.0$/, '') + suffix;
  }
}
