import { Component, OnInit } from '@angular/core';
import { CalendarView, DAYS_OF_WEEK, CalendarEventAction, CalendarEvent, CalendarModule, CalendarEventTimesChangedEvent } from 'angular-calendar';
import { isSameMonth, isSameDay, addDays, addMonths, addWeeks, startOfMonth, startOfWeek } from 'date-fns';
import { Subject } from 'rxjs';
import { TaskList } from '../../../../../models/TaskList';
import { colors } from '../../../../../utils/colors';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FamilyService } from '../../../../../services/family.service';
import { ContextMenuModule } from 'primeng/contextmenu';
import { ConfirmationService, MenuItem, MenuItemCommandEvent, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AssignTaskModalComponent } from '../assign-task-modal/assign-task-modal.component';
import { CompletionStatus } from '../../../../../models/CompletionStatuts';
import { AssignedTask } from '../../../../../models/AssignedTask';
import { FamilyMember } from '../../../../../models/FamilyMember';

@Component({
  selector: 'app-assign-tasks-calendar',
  imports: [CalendarModule, CommonModule, SelectButtonModule, FormsModule, ButtonModule, ContextMenuModule],
  templateUrl: './assign-tasks-calendar.component.html',
  styleUrl: './assign-tasks-calendar.component.less'
})
export class AssignTasksCalendarComponent implements OnInit {

  date: Date = new Date();

  ref: DynamicDialogRef | undefined;

  taskLists: TaskList[] = [];

  sendings: { [key: number]: boolean } = {};

  view: CalendarView = CalendarView.Month;

  CalendarView = CalendarView;

  ViewDateChange = ViewDateChange;

  calendarView = Object.values(CalendarView);

  viewDate: Date = new Date();

  refresh = new Subject<void>();

  activeDayIsOpen: boolean = true;

  weekStartsOn: number = DAYS_OF_WEEK.MONDAY;

  weekendDays: number[] = [];

  viewOption?: string;

  actions: CalendarEventAction[] = [
    {
      label: '<i class="pi pi-pencil""></i>',
      a11yLabel: 'Edit',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.editTask(event);
      },
    },
    {
      label: '<i class="pi pi-trash""></i>',
      a11yLabel: 'Delete',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.openDeleteConfirmDialog(event);
      },
    },
  ];

  events: CalendarEvent<{ taskList: TaskList, assignedTask: AssignedTask }>[] = [];

  items: MenuItem[] = [
    {
      label: 'Add event',
      icon: 'pi pi-plus',
      command: (event: MenuItemCommandEvent) => this.addEvent(event)
    },
  ]

  constructor(
    private familyService: FamilyService,
    private dialogService: DialogService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  async ngOnInit(): Promise<void> {
    this.refreshData();
  }

  async refreshData() {
    this.taskLists = await this.familyService.getFamilyTaskLists();
    this.createCalendarEvents();
  }

  createCalendarEvents() {
    this.events = [];

    for (const taskList of this.taskLists) {
      for (const assignedTask of taskList.assignedTasks)
        this.events.push({
          start: assignedTask.start,
          end: assignedTask.end,
          title: `${taskList.task.name}${assignedTask.points ? ` - ${assignedTask.points} pts` : ''}`,
          color: colors[assignedTask.status],
          actions: assignedTask.status != CompletionStatus.completed ? this.actions : [],
          meta: {
            taskList,
            assignedTask
          },
          resizable: {
            beforeStart: assignedTask.status != CompletionStatus.completed && assignedTask.status != CompletionStatus.pending,
            afterEnd: assignedTask.status != CompletionStatus.completed,
          },
          draggable: assignedTask.status != CompletionStatus.completed,
        })
    };
  }

  setView(view: CalendarView) {
    this.view = view;
  }

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    if (isSameMonth(date, this.viewDate)) {
      if (
        (isSameDay(this.viewDate, date) && this.activeDayIsOpen === true) ||
        events.length === 0
      ) {
        this.activeDayIsOpen = false;
      } else {
        this.activeDayIsOpen = true;
      }
      this.viewDate = date;
    }
  }

  editTask(event: CalendarEvent) {
    this.ref = this.dialogService.open(
      AssignTaskModalComponent,
      {
        header: `Assign task`,
        modal: true,
        closable: true,
        data: {
          ...event.meta,
          new: false
        }
      })

    this.ref.onClose.subscribe((x) => {
      this.refreshData();
    })
  }

  async openDeleteConfirmDialog(event: CalendarEvent<{ taskList: TaskList, assignedTask: AssignedTask }>) {
    this.confirmationService.confirm({
      header: 'Confirm deletion',
      message: `Are you sure you want to delete this task?`,
      accept: async () => this.deleteTask(event.meta!.taskList.member!, event.meta!.assignedTask)
    });
  }

  async deleteTask(member: FamilyMember, assignedTask: AssignedTask) {
    try {
      await this.familyService.deleteAssignedTask(member, assignedTask);
      this.messageService.add({
        severity: 'success',
        summary: 'Deleted',
        detail: 'The task has been deleted successfully!'
      });
    } catch (err) {
      console.error(err);
      this.messageService.add({
        severity: 'error',
        summary: 'Failure',
        detail: 'Something went wrong, the task has not been deleted. Please try again.'
      });
    } finally {
      await this.refreshData();
    }
  }

  onChangeViewDate(type: ViewDateChange) {
    this.createCalendarEvents();
  }

  onContextMenu(date: Date) {
    this.date = date;
  }

  addEvent(event: MenuItemCommandEvent) {
    this.openTaskAssignmentModal(this.date);
  }

  openTaskAssignmentModal(date: Date) {
    this.ref = this.dialogService.open(
      AssignTaskModalComponent,
      {
        header: `Assign task`,
        modal: true,
        closable: true,
        data: {
          taskList: {
            start: date
          },
          new: true
        }
      });

    this.ref.onClose.subscribe((x) => {
      this.refreshData();
    })
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
  }

  async eventTimesChanged({
    event,
    newStart,
    newEnd,
  }: CalendarEventTimesChangedEvent<{ taskList: TaskList, assignedTask: AssignedTask }>): Promise<void> {
    const taskList: TaskList = event.meta?.taskList!;
    const assignedTask: AssignedTask = event.meta?.assignedTask!;

    if (newStart.getTime() < Date.now()) {
      this.messageService.add({
          severity: 'error',
          summary: 'Failure',
          detail: 'A task cannot be assigned in the past!',
        });
    } else {
      assignedTask.start = newStart;
      assignedTask.end = newEnd;
      try {
        this.events = this.events.map((iEvent) => {
          if (iEvent === event) {
            return {
              ...event,
              start: newStart,
              end: newEnd,
            };
          }
          return iEvent;
        });
        await this.familyService.updateAssignedTask(taskList.member!, { ...taskList, ...assignedTask }, assignedTask);
        this.messageService.add({
          severity: 'success',
          summary: 'Edited',
          detail: 'The assigned task has been edited.',
        });
      } catch (err: any) {
        console.error(err);
        const detail = err.error?.message
          ? `The following error occured: ${err.error?.message}`
          : 'Something went wrong, the task has not been edited. Please try again.';
        this.messageService.add({
          severity: 'error',
          summary: 'Failure',
          detail,
        });
      } finally {
        this.refreshData();
      }
    }
  }

  handleEvent(action: string, event: CalendarEvent): void {
    // TODO: open descriptive modal
  }
}

enum ViewDateChange {
  previous = 'previous',
  today = 'today',
  next = 'next',
  day = 'day',
  week = 'week',
  month = 'month'
}