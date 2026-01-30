import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FeedbackService, Feedback } from '../../services/feedback.service';
import { FirebaseService } from '../../services/firebase.service';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.css'
})
export class FeedbackComponent {
  recent = signal<Feedback[]>([]);
  pageItems = signal<Feedback[]>([]);
  pageStack: (QueryDocumentSnapshot<DocumentData> | null)[] = [null];
  pageIndex = signal<number>(0);
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  disabledUntil = signal<number>(0);
  message = signal<string | null>(null);

  isAllShow = false;

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
    this.loadPage(0);
  }

  async loadRecent() {
    try {
      const items = await this.feedback.getRecentFeedbacks(30);
      this.recent.set(items);
    } catch { }
  }
  async loadPage(indexDelta: number = 0) {
    try {
      const nextIndex = Math.max(0, this.pageIndex() + indexDelta);
      const cursor = this.pageStack[nextIndex] ?? null;
      const res = await this.feedback.getFeedbackPage(10, cursor);
      this.pageItems.set(res.items);
      this.lastDoc = res.lastDoc;
      if (indexDelta >= 0) {
        const newIndex = nextIndex + 1;
        this.pageStack[newIndex] = this.lastDoc;
        this.pageIndex.set(nextIndex + 1);
      } else {
        this.pageIndex.set(nextIndex);
      }
    } catch { }
  }
  async nextPage() {
    await this.loadPage(0);
    if (this.lastDoc) {
      await this.loadPage(0);
    }
  }
  async prevPage() {
    const current = this.pageIndex();
    const prevIndex = Math.max(0, current - 2);
    const cursor = this.pageStack[prevIndex] ?? null;
    const res = await this.feedback.getFeedbackPage(10, cursor);
    this.pageItems.set(res.items);
    this.lastDoc = res.lastDoc;
    this.pageIndex.set(prevIndex + 1);
  }
  formatDate(ts: any): string {
    try {
      if (!ts) return '';
      const ms = ts.seconds ? ts.seconds * 1000 : (typeof ts === 'number' ? ts : Date.now());
      const d = new Date(ms);
      return d.toLocaleString();
    } catch {
      return '';
    }
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
    await this.loadPage(0);
  }

  setRating(r: number) {
    this.form.patchValue({ rating: r });
  }
}
