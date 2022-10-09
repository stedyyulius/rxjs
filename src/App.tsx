import { map, takeWhile, scan, startWith } from "rxjs/operators";
import { bind, shareLatest, Subscribe } from "@react-rxjs/core";
import {
  createSignal,
  partitionByKey,
  combineKeys,
  mergeWithKey
} from "@react-rxjs/utils";
import * as React from "react";

// entry points for user actions
const [newTodo$, onNewTodo] = createSignal<string>();
const [editTodo$, onEditTodo] = createSignal<{ id: number; text: string }>();
const [toggleTodo$, onToggleTodo] = createSignal<number>();
const [deleteTodo$, onDeleteTodo] = createSignal<number>();

const todoActions$ = mergeWithKey({
  add: newTodo$.pipe(map((text, id) => ({ id: id, text }))),
  edit: editTodo$,
  toggle: toggleTodo$.pipe(map((id) => ({ id }))),
  delete: deleteTodo$.pipe(map((id) => ({ id })))
});

type Todo = { id: number; text: string; done: boolean };
const [todosById, keys$] = partitionByKey(
  todoActions$,
  (event) => event.payload.id,
  (event$, id) =>
    event$.pipe(
      takeWhile((event) => event.type !== "delete"),
      scan(
        (state, action) => {
          switch (action.type) {
            case "add":
            case "edit":
              return { ...state, text: action.payload.text };
            case "toggle":
              return { ...state, done: !state.done };
            default:
              return state;
          }
        },
        { id, text: "", done: false } as Todo
      )
    )
);

const todosMap$ = combineKeys(keys$, todosById) as any;

const todosList$ = todosMap$.pipe(
  map((x: any) => [...x.values()]),
  shareLatest() // We are using shareLatest because the stats will also consume it
);

export enum FilterType {
  All = "all",
  Done = "done",
  Pending = "pending"
}
const [selectedFilter$, onSelectFilter] = createSignal<FilterType>();

const [useCurrentFilter, currentFilter$] = bind(
  selectedFilter$.pipe(startWith(FilterType.All))
);

const [useTodos, todos$] = bind(keys$);
const [useTodo, todo$] = bind((id: number) => todosById(id));

function TodoListFilters() {
  const filter = useCurrentFilter();

  const updateFilter = ({ target }: any) => {
    onSelectFilter(target.value);
  };

  return (
    <>
      Filter:
      <select className="border-solid border-2" value={filter} onChange={updateFilter}>
        <option value={FilterType.All}>All</option>
        <option value={FilterType.Done}>Completed</option>
        <option value={FilterType.Pending}>Uncompleted</option>
      </select>
    </>
  );
}

const [useTodosStats, stats$] = bind(
  todosList$.pipe(
    map((todosList: Todo[]) => {
      const nTotal = todosList.length;
      const nCompleted = todosList.filter((item) => item.done).length;
      const nUncompleted = nTotal - nCompleted;
      const percentCompleted =
        nTotal === 0 ? 0 : Math.round((nCompleted / nTotal) * 100);

      return {
        nTotal,
        nCompleted,
        nUncompleted,
        percentCompleted
      };
    })
  ),
  { nTotal: 0, nCompleted: 0, nUncompleted: 0, percentCompleted: 0 }
);

function TodoListStats() {
  const {
    nTotal,
    nCompleted,
    nUncompleted,
    percentCompleted
  } = useTodosStats();

  return (
    <ul className="border-solid border-2 p-6">
      <li className="text-3xl font-bold underline">Total items: {nTotal}</li>
      <li>Items completed: {nCompleted}</li>
      <li>Items not completed: {nUncompleted}</li>
      <li>Percent completed: {percentCompleted}</li>
    </ul>
  );
}

function TodoItemCreator() {
  const [inputValue, setInputValue] = React.useState("");

  const addItem = () => {
    onNewTodo(inputValue);
    setInputValue("");
  };

  const onChange = ({ target }: any) => {
    setInputValue(target.value);
  };

  return (
    <div className="mt-[80px]">
      <input className="border-solid border-2" type="text" value={inputValue} onChange={onChange} />
      <button onClick={addItem}>Add</button>
    </div>
  );
}

const TodoItem: React.FC<{ id: number }> = ({ id }) => {
  const item = useTodo(id);
  const currentFilter = useCurrentFilter();

  return !(
    currentFilter === "all" ||
    (currentFilter === "done" && item.done) ||
    (currentFilter === "pending" && !item.done)
  ) ? null : (
    <div>
      <input
        type="text"
        value={item.text}
        onChange={({ target }) => {
          onEditTodo({ id: item.id, text: target.value });
        }}
      />
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => {
          onToggleTodo(item.id);
        }}
      />
      <button
        onClick={() => {
          onDeleteTodo(item.id);
        }}
      >
        X
      </button>
    </div>
  );
};

function TodoList() {
  const todoList = useTodos();

  return (
    <div className="flex flex-col justify-center items-center">
      <TodoListStats />
      <TodoListFilters />
      <TodoItemCreator />

      {todoList.map((id) => (
        <TodoItem key={id} id={id} />
      ))}
    </div>
  );
}
export default function App() {
  return (
    <Subscribe>
      <React.Suspense fallback={<p>wait</p>}>
        <TodoList />
      </React.Suspense>
    </Subscribe>
  );
}