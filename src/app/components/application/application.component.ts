import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
interface EstimateStep {
    task: string;
    description: string;
    hoursMin: number; // Змінюємо на number для математичних операцій
    hoursMax: number;
}

@Component({
    selector: 'app-application',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './application.component.html',
    styleUrls: ['./application.component.css']
})
export class ApplicationComponent {
    estimateData = signal<EstimateStep[]>([
    { 
        task: 'Setup & Architecture', 
        description: 'Angular setup (Standalone, State Management), UI-kit, Form-framework (ReactiveForms/Signals), responsive layout structures.', 
        hoursMin: 16, 
        hoursMax: 20 
    },
    { 
        task: 'Data Models & State', 
        description: 'Creating interfaces for all 9 steps, setting up a service for progress saving (Drafts).', 
        hoursMin: 8, 
        hoursMax: 10 
    },
    { 
        task: 'Form Implementation', 
        description: 'Implementing 9 steps (components, validators, masks for SSN/Phone).', 
        hoursMin: 32, 
        hoursMax: 40 
    },
    { 
        task: 'Wizard Logic', 
        description: 'Step-switching logic, "Continue application", Progress Bar, error handling.', 
        hoursMin: 12, 
        hoursMax: 16 
    },
    { 
        task: 'Integration (API)', 
        description: 'Backend integration, handling responses (Success/Pending/Denied/Routing), working with access tokens.', 
        hoursMin: 20, 
        hoursMax: 24 
    },
    { 
        task: 'Details Page', 
        description: 'Details page after "submitted form", read-only view.', 
        hoursMin: 16, 
        hoursMax: 20 
    },
    { 
        task: 'Email Templates', 
        description: 'Emails with confirmations, invitations, etc.', 
        hoursMin: 8, 
        hoursMax: 10 
    },
    { 
        task: 'UI/UX Polishing', 
        description: 'Mobile responsiveness, loading states, transition animations.', 
        hoursMin: 12, 
        hoursMax: 18 
    },
]);

    // Автоматичний розрахунок за допомогою computed
    totalMin = computed(() => this.estimateData().reduce((sum, item) => sum + item.hoursMin, 0));
    totalMax = computed(() => this.estimateData().reduce((sum, item) => sum + item.hoursMax, 0));

    // Метод для оновлення значення, якщо ви захочете змінити його в інпуті
    updateHours(index: number, field: 'hoursMin' | 'hoursMax', value: number) {
        this.estimateData.update(data => {
            const newData = [...data];
            newData[index][field] = value;
            return newData;
        });
    }
    exportPDF() {
    const doc = new jsPDF();
    
    // Викликаємо функцію autoTable, передаючи екземпляр doc як перший аргумент
    autoTable(doc, {
        head: [['Stage of work', 'Description', 'Estimate']],
        body: this.estimateData().map(i => [i.task, i.description, `${i.hoursMin}-${i.hoursMax}`]),
    });
    
    doc.save('application_estimate_frontend.pdf');
}
}
