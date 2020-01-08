<template>
  <div class="challenge" :class="backgroundClass">
    <div v-if="editing" class="row">
      <input v-if="challenge.done" type="checkbox" v-on:change="challengeDone" checked disabled />
      <input v-else type="checkbox" v-on:change="challengeDone" disabled />
      <input class="main-content" v-model="newChallengeText" :placeholder="challenge.text" />
      <button @click="changeChallengeText()" class="button">Save</button>
      <button @click="editing = !editing" class="button">Cancel</button>
    </div>
    <div v-else class="row">
      <input
        v-if="challenge.done"
        type="checkbox"
        v-on:change="challengeDone"
        checked
        :disabled="challenge.expired"
      />
      <input v-else type="checkbox" v-on:change="challengeDone" :disabled="challenge.expired" />
      <div class="main-content" v-bind:class="{'done-strikethrough':challenge.done}">{{fullText}}</div>
      <button @click="editing=!editing" class="button">Edit</button>
      <button @click="$emit('delete-challenge', challenge.id)" class="button">Delete</button>
    </div>
  </div>
</template>

<script>
export default {
  name: "Challenge",
  data() {
    return {
      fullText: "",
      newChallengeText: "",
      editing: false
    };
  },
  created() {
    this.fullText = this.constructFullText();
    setInterval(this.update, 1000);
  },
  methods: {
    challengeDone() {
      this.update();
      if (!this.challenge.expired) {
        this.challenge.done = !this.challenge.done;
      }
    },
    update() {
      let currentTime = Math.floor(Date.now() / 1000);
      if (currentTime > this.challenge.expires) {
        this.challenge.expired = true;
      }
      this.fullText = this.constructFullText();
    },
    changeChallengeText() {
      if (this.newChallengeText == "") {
        alert("You cannot give Challenges an empty name!");
        return;
      }
      this.update();
      this.$emit("change-text", this.challenge.id, this.newChallengeText);
      this.editing = !this.editing;
      this.newChallengeText = "";
    },
    constructFullText() {
      let currentTime = Math.floor(Date.now() / 1000);
      if (!this.challenge.expired) {
        return (
          this.challenge.text +
          " (" +
          (this.challenge.expires - currentTime) +
          "s remaining)"
        );
      } else {
        return (
          this.challenge.text +
          " (expired " +
          (currentTime - this.challenge.expires) +
          "s ago)"
        );
      }
    }
  },
  props: ["challenge"],
  computed: {
    backgroundClass() {
      if (this.editing) {
        return "edit-background";
      } else if (
        !this.challenge.done &&
        !this.editing &&
        !this.challenge.expired
      ) {
        return "default-background";
      } else if (this.challenge.expired && !this.challenge.done) {
        return "expired";
      } else {
        return "done-background";
      }
    }
  }
};
</script>

<style scoped>
.challenge {
  border-bottom: 1px #444 dotted;
}

.default-background {
  background: #ffff6b;
}

.edit-background {
  background: #fdd835;
}

.done-background {
  background: #f9ffb6;
}

.done-strikethrough {
  text-decoration: line-through;
}

.expired {
  background: #ff6161;
}

.main-content {
  flex: 10;
  margin-right: 5px;
}

.row {
  display: flex;
  align-items: center;
}
</style>