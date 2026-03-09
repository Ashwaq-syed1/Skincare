// app/chat.component.ts (top of file)
import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  ViewChild,
  ElementRef,
  inject,
  signal,
  effect,
  SecurityContext,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as prism from 'prismjs';
import { take } from 'rxjs/operators';

import { ChatMessageComponent } from './chat-message.component';
import { ChatService } from './chat.service';
import { STATIC_FILE_PATH } from './constants';
import { ChatMessage, Profile, ViewCodeEvent } from './types';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    MatTooltipModule,
    ChatMessageComponent,
    MatProgressSpinnerModule,
    OverlayModule,
  ],
  templateUrl: './chat.ng.html',
  styleUrls: ['./chat.scss'],
})
export class ChatComponent implements OnInit {
  /** Template refs (expects #chatMessages and #sqlDialog in template) */
  @ViewChild('chatMessages', { read: ElementRef, static: false })
  private chatMessages?: ElementRef;

  @ViewChild('sqlDialog', { read: ElementRef, static: false })
  private sqlDialog?: ElementRef;

  /** Inputs */
  @Input() profile!: Profile;

  /** Signals */
  sessionId: string | null = null;
  newMessage = '';
  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  isChatOpen = signal(false);
  viewCodeContent = signal<ViewCodeEvent | null>(null);

  /** Derived/computed getters used in template (use without parentheses) */
  get highlightedGeneratedQueryHtml(): SafeHtml | string {
    const sqlCode = this.viewCodeContent()?.generatedQuery;
    if (sqlCode) {
      return toHighlightedSqlHtml(this.sanitizer, sqlCode);
    }
    return '';
  }

  get highlightedNlaQueryHtml(): SafeHtml | string {
    const sqlCode = this.viewCodeContent()?.alloyDbNlaQuery;
    if (sqlCode) {
      return toHighlightedSqlHtml(this.sanitizer, sqlCode);
    }
    return '';
  }

  /** Injected services (using inject to match your style) */
  private readonly chatService = inject(ChatService);
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    // Auto-scroll effect when chat opens or messages change
    effect((onCleanup) => {
      const messageContainer = this.isChatOpen() ? this.chatMessages?.nativeElement : null;
      if (!messageContainer) return;
      const observer = new ResizeObserver(() => {
        scrollToBottom(messageContainer.parentElement);
      });
      observer.observe(messageContainer);
      if (messageContainer.parentElement) {
        observer.observe(messageContainer.parentElement);
      }
      onCleanup(() => observer.disconnect());
    });
  }

  ngOnInit(): void {
    this.sessionId = Math.floor(Math.random() * 1e15).toString();

    // Add welcome message
    this.messages.update((msgs) => [
      ...msgs,
      {
        sender: 'bot',
        senderAvatar: `${STATIC_FILE_PATH}assistant.svg`,
        text:
          "Hi there! Looking for the perfect skincare? I'm here to help! Feel free to ask me to find products based on your needs, get detailed information about any item, or even check your order history. Plus, if you've got a favorite product, I can help you discover similar gems.\n\nWhat can I do for you today?",
        timestamp: new Date(),
      },
    ]);
  }

  toggleChat(): void {
    this.isChatOpen.update((open) => !open);
  }

  closeChat(event?: KeyboardEvent): void {
    if (!event || (event as KeyboardEvent).key === 'Escape') {
      if (!this.viewCodeContent()) {
        this.isChatOpen.set(false);
      } else {
        this.viewCodeContent.set(null);
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
  }

  orderConfirmed(details: ChatMessage['orderDetails'] | null): void {
    if (!details?.product) {
      this.messages.update((msgs) => [
        ...msgs,
        {
          sender: 'bot',
          senderAvatar: `${STATIC_FILE_PATH}assistant.svg`,
          text: "Sorry, I couldn't process your order. Please try again.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // mark message as confirming
    this.messages.update((msgs) =>
      msgs.map((msg) => {
        if (
          msg.orderDetails?.product === details.product &&
          msg.orderDetails?.nonce === details.nonce
        ) {
          return {
            ...msg,
            orderDetails: { ...msg.orderDetails, status: 'CONFIRMING' },
          };
        }
        return msg;
      })
    );

    // send confirmation to backend
    this.chatService
      .processMessage(`I confirm the order with product name: ${details.product}`, this.sessionId)
      .pipe(take(1))
      .subscribe((response) => {
        this.messages.update((msgs) =>
          msgs.map((msg) => {
            if (
              msg.orderDetails?.product === details.product &&
              msg.orderDetails?.nonce === details.nonce
            ) {
              return {
                ...response,
                orderDetails: { ...response.orderDetails },
              } as ChatMessage;
            }
            return msg;
          })
        );
      });
  }

  sendMessage(): void {
    if (!this.newMessage.trim()) return;

    this.isLoading.set(true);

    // Add user message
    this.messages.update((msgs) => [
      ...msgs,
      {
        sender: 'user',
        senderAvatar: this.profile?.imageUrl ?? '',
        text: this.newMessage,
        timestamp: new Date(),
      },
    ]);

    const userQuery = this.newMessage;
    const sessionId = this.sessionId;
    this.newMessage = '';

    // Send to service and get response
    this.chatService
      .processMessage(userQuery, sessionId)
      .pipe(take(1))
      .subscribe((response) => {
        this.messages.update((msgs) => [...msgs, response]);
        this.isLoading.set(false);
      });
  }

  sqlDialogClicked(event: MouseEvent): void {
    if (event.target === this.sqlDialog?.nativeElement) {
      this.viewCodeContent.set(null);
    }
  }
}

/* ---------- helpers ---------- */

function toHighlightedSqlHtml(sanitizer: DomSanitizer, sqlCode: string): SafeHtml | string {
  const highlightedCode = prism.highlight(sqlCode, prism.languages['sql'], 'sql');
  const sanitized = sanitizer.sanitize(SecurityContext.HTML, highlightedCode) ?? '';
  return sanitized;
}

function scrollToBottom(element: HTMLElement | null): void {
  if (!element) return;
  element.scrollTop = element.scrollHeight;
}
