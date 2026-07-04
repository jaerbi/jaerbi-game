import { ChangeDetectorRef, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import html2canvas from 'html2canvas';

@Component({
    selector: 'app-mizael',
    imports: [CommonModule, FormsModule, DragDropModule],
    templateUrl: 'mizael.component.html',
    styleUrl: 'mizael.component.css',
})
export class MizaelComponent {
    
}
