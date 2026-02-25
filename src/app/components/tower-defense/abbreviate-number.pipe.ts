import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'abbreviateNumber',
  standalone: true
})
export class AbbreviateNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '0';

    let num = Math.floor(Number(value)); 
    
    if (isNaN(num) || num === 0) return '0';

    if (Math.abs(num) < 1000) {
      return num.toString();
    }

    const suffixes = ['', 'k', 'M', 'B', 'T', 'Q'];

    const tier = Math.floor(Math.log10(Math.abs(num)) / 3);

    const sIndex = Math.min(tier, suffixes.length - 1);
    const suffix = suffixes[sIndex];
    const scale = Math.pow(10, sIndex * 3);

    const scaled = num / scale;
    let result = scaled >= 10 
      ? Math.floor(scaled).toString() 
      : scaled.toFixed(1).replace(/\.0$/, '');

    return result + suffix;
  }
}
