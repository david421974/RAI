import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about-rai-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-rai-modal.component.html',
  styleUrls: ['./about-rai-modal.component.css'],
})
export class AboutRaiModalComponent {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }
}
