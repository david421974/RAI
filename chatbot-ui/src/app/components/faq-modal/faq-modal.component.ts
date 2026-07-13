import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface FaqEntry {
  question: string;
  payload: string;
}

@Component({
  selector: 'app-faq-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faq-modal.component.html',
  styleUrls: ['./faq-modal.component.css'],
})
export class FaqModalComponent implements OnInit {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();
  @Output() faqSelected = new EventEmitter<FaqEntry>();

  searchTerm = '';
  loading = false;
  allFaqs: FaqEntry[] = [];
  filteredFaqs: FaqEntry[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchIntents();
  }

  private fetchIntents(): void {
    this.loading = true;
    this.http.get<any[]>('http://localhost:7000/intents/top?limit=100').subscribe({
      next: (items) => {
        this.allFaqs = (items || []).map(i => ({
          question: i.label,
          payload: i.payload
        }));
        this.filteredFaqs = [...this.allFaqs];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando FAQs:', err);
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredFaqs = term 
      ? this.allFaqs.filter(f => f.question.toLowerCase().includes(term))
      : [...this.allFaqs];
  }

  onSelect(faq: FaqEntry): void { this.faqSelected.emit(faq); }
  onClose(): void { this.closed.emit(); }
}
