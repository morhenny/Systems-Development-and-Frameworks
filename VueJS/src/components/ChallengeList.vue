<template>
  <div>
    <div v-for="challenge in challengeList" v-bind:key="challenge.id">
      <Challenge
        v-bind:challenge="challenge"
        v-on:delete-challenge="$emit('delete-challenge', challenge.id)"
        v-on:change-text="changeChallengeText"
      />
    </div>
  </div>
</template>

<script>
import Challenge from "./Challenge";

export default {
  name: "ChallengeList",
  components: {
    Challenge
  },
  methods: {
    changeChallengeText(id, text) {
      this.$emit("change-text", id, text);
    }
  },
  props: ["challengeList"]
};
</script>

<style scoped>
</style>