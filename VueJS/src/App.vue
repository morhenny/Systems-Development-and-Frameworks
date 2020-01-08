<template>
  <div id="app">
    <Header />
    <ChallengeList
      v-bind:challengeList="challengeList"
      v-on:delete-challenge="deleteChallenge"
      v-on:change-text="changeChallengeText"
    />
    <TodoList
      v-bind:todoList="todoList"
      v-on:delete-todo="deleteTodo"
      v-on:change-text="changeTodoText"
    />
    <AddTodo v-on:add-todo="addTodo" />
    <AddChallenge v-on:add-challenge="addChallenge" />
  </div>
</template>

<script>
import Header from "./components/layout/Header";
import TodoList from "./components/TodoList";
import ChallengeList from "./components/ChallengeList";
import AddTodo from "./components/AddTodo";
import AddChallenge from "./components/AddChallenge";

export default {
  name: "app",
  components: {
    Header,
    ChallengeList,
    TodoList,
    AddTodo,
    AddChallenge
  },
  data() {
    let currentTime = Math.floor(Date.now() / 1000);
    return {
      todoList: [
        {
          id: 1,
          text: "Abrechnen",
          done: false
        },
        {
          id: 2,
          text: "Einkaufen",
          done: false
        },
        {
          id: 3,
          text: "Packen",
          done: false
        }
      ],
      challengeList: [
        {
          id: 1,
          text: "Party vorbereiten",
          done: false,
          expires: currentTime + 10,
          expired: false
        },
        {
          id: 2,
          text: "Blumen gießen",
          done: false,
          expires: currentTime + 3600,
          expired: false
        },
        {
          id: 3,
          text: "Lernen",
          done: true,
          expires: currentTime + 100,
          expired: false
        }
      ]
    };
  },
  methods: {
    deleteTodo(id) {
      this.todoList = this.todoList.filter(todo => todo.id !== id);
    },
    changeTodoText(id, newText) {
      this.todoList.forEach(todo => {
        if (todo.id === id) {
          todo.text = newText;
        }
      });
    },
    addTodo(newTodo) {
      this.todoList.push(newTodo);
    },
    deleteChallenge(id) {
      this.challengeList = this.challengeList.filter(
        challenge => challenge.id !== id
      );
    },
    changeChallengeText(id, newText) {
      this.challengeList.forEach(challenge => {
        if (challenge.id === id) {
          challenge.text = newText;
        }
      });
    },
    addChallenge(newChallenge) {
      this.challengeList.push(newChallenge);
    }
  }
};
</script>

<style>
.button {
  flex: 2;
  border: none;
  background: #4caf50;
  color: #fff;
  padding: 10px 20px;
  cursor: pointer;
}

.button:hover {
  background: #43a047;
}
</style>
