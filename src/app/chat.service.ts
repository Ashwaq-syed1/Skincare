// app/chat.service.ts
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { STATIC_FILE_PATH } from './constants';
import { ChatMessage, WindowWithEnv } from './types';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private userId: string | null = null;
  private orderNonce = 0;
  private promptText = '';

  setUserId(userId: string) {
    this.userId = userId;
  }

  processMessage(
    message: string,
    sessionId: string | null
  ): Observable<ChatMessage> {
    console.log('userId = ', this.userId);
    this.orderNonce++;

    const url = (window as unknown as WindowWithEnv).ENV?.magicApiUrl ?? '';

    return this.http.post<any>(url, {
      query: message,
      sessionId,
      userId: this.userId,
    }).pipe(
      map((response: any) => {
        console.log('Magic API Response:', JSON.stringify(response));

        // Order-related responses
        if (
          response.selected_api === 'OrderInsert' ||
          response.selected_api === 'OrderCheckout'
        ) {
          return {
            text: response.response,
            sender: 'bot',
            senderAvatar: `${STATIC_FILE_PATH}assistant.svg`,
            orderDetails: {
              credit_card: response.order_details?.credit_card,
              shipping_address: response.order_details?.shipping_address,
              order_id: response.order_details?.order_id,
              product: response.order_details?.product ?? '',
              name: response.order_details?.product_name,
              price: response.order_details?.price,
              status: response.order_status,
              nonce: this.orderNonce,
            },
            timestamp: new Date(),
          } as ChatMessage;
        }

        // SQL results only
        if (response.selected_api === 'getResultsOnly') {
          return {
            ...toChatMessage(response.response || 'Here are the results:'),
            sqlQuery: response.nl2sql,
            nlaQuery: response.message,
            tableData: this.parseDataToTableFormat(response.result),
          } as ChatMessage;
        }

        // Text summary only
        if (response.selected_api === 'getSummaryOnly') {
          return toChatMessage(response.response);
        }

        // Both summary and results
        if (response.selected_api === 'getSummaryAndResults') {
          return {
            ...toChatMessage(response.response),
            sqlQuery: response.nl2sql,
            nlaQuery: message,
            tableData: this.parseDataToTableFormat(response.result),
          } as ChatMessage;
        }

        // Fallback
        return toChatMessage(
          response.response || "I'm unable to answer that question. Try again."
        );
      }),
      catchError((error) => {
        console.error('Error in processMessage:', error);
        return of(toChatMessage("I'm unable to answer that question. Try again."));
      })
    );
  }

  private parseDataToTableFormat(data: any): { columns: any[]; rows: any[] } {
    if (!data || typeof data !== 'object') {
      return { columns: [], rows: [] };
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { columns: [], rows: [] };
      }

      const columns = Object.keys(data[0]).map((key) => ({
        key,
        header: this.formatColumnName(key),
      }));

      return {
        columns,
        rows: data,
      };
    }

    // Single object (not an array)
    const columns = Object.keys(data).map((key) => ({
      key,
      header: this.formatColumnName(key),
    }));

    return {
      columns,
      rows: [data],
    };
  }

  private formatColumnName(column: string): string {
    return column
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

/** Utility helper outside the class */
function toChatMessage(text?: string): ChatMessage {
  return {
    text: text ?? "I'm unable to answer that question. Try again.",
    sender: 'bot',
    timestamp: new Date(),
    senderAvatar: `${STATIC_FILE_PATH}assistant.svg`,
  } as ChatMessage;
}
