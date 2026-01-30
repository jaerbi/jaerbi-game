import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FeedbackService, Feedback } from '../../services/feedback.service';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.css'
})
export class FeedbackComponent {
  recent = signal<Feedback[]>([]);
  disabledUntil = signal<number>(0);
  message = signal<string | null>(null);

  form!: FormGroup<{ text: FormControl<string>, rating: FormControl<number> }>;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private feedback: FeedbackService,
    public firebase: FirebaseService,
  ) {
    this.form = new FormGroup({
      text: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10), Validators.maxLength(500)] }),
      rating: new FormControl<number>(5, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(5)] }),
    });
    this.loadRecent();
    const user = this.firebase.user$();
    if (user) {
      const key = `feedback_throttle_${user.uid}`;
      const until = Number(localStorage.getItem(key) || 0);
      this.disabledUntil.set(until);
    }
  }

  async loadRecent() {
    try {
      const items = await this.feedback.getRecentFeedbacks(30);
      this.recent.set(items);
    } catch { }
  }

  get canSubmit(): boolean {
    const user = this.firebase.user$();
    if (!user) return false;
    if (Date.now() < this.disabledUntil()) return false;
    return this.form.valid;
  }
  get throttleActive(): boolean {
    return Date.now() < this.disabledUntil();
  }

  async submit() {
    const user = this.firebase.user$();
    if (!user) return;
    const { allowed, remaining } = await this.feedback.canUserPostToday(user.uid);
    if (!allowed) {
      this.message.set('Daily limit reached: 3 feedbacks per 24 hours.');
      return;
    }
    const val = this.form.value;
    const data: Feedback = {
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      userPhoto: user.photoURL || '',
      text: val.text || '',
      rating: Number(val.rating) || 5
    };
    await this.feedback.addFeedback(data);
    this.message.set('Thanks! Your feedback was submitted.');
    this.form.reset({ text: '', rating: 5 });
    const key = `feedback_throttle_${user.uid}`;
    const until = Date.now() + 5 * 60 * 1000;
    localStorage.setItem(key, String(until));
    this.disabledUntil.set(until);
    await this.loadRecent();
  }

  setRating(r: number) {
    this.form.patchValue({ rating: r });
  }
}
