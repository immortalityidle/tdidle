import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import { AppComponent, BigNumberPipe } from './app.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [
    AppComponent,
    BigNumberPipe,
  ],
  imports: [
    BrowserModule,
    NoopAnimationsModule
  ],
  exports: [
    MatSnackBarModule,
  ],
  providers: [
    BigNumberPipe,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
