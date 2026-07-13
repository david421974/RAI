import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface FaqItem {
  label: string;
  payload: string;
}

@Component({
  selector: 'app-faq-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq-section.component.html',
  styleUrl: './faq-section.component.css',
})
export class FaqSectionComponent implements OnInit {
  @Input() faqs: FaqItem[] = [];
  @Input() loadTopIntents = false;
  @Output() faqSelected = new EventEmitter<string>();

  visibleCount = 4;
  expanded = false;
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (this.loadTopIntents) {
      this.fetchTopIntents();
    }
  }

  get visibleFaqs(): FaqItem[] {
    return this.expanded ? this.faqs : this.faqs.slice(0, this.visibleCount);
  }

  get hasMore(): boolean {
    return !this.expanded && this.faqs.length > this.visibleCount;
  }

  private fetchTopIntents(): void {
    this.loading = true;
    this.http
      .get<Array<{ label: string; payload: string }>>('http://localhost:7000/intents/top?limit=4')
      .subscribe({
        next: (items) => {
          const nextFaqs = (items || []).map((i) => ({ label: i.label, payload: i.payload }));
          // Si la API no devuelve datos, mantenemos las sugerencias que ya venían por @Input.
          if (nextFaqs.length > 0) {
            this.faqs = nextFaqs;
          }
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  onFaqClick(faq: FaqItem): void {
    this.faqSelected.emit(faq.label);
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }
}
